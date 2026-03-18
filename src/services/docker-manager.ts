import Docker from "dockerode";
import { config } from "../config.js";
import { portAllocator } from "./port-allocator.js";

const docker = new Docker();

const LABEL_PREFIX = "review-env";

function parseMemory(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(g|m)$/i);
  if (!match) return 4 * 1024 * 1024 * 1024;
  const num = parseFloat(match[1]!);
  return match[2]!.toLowerCase() === "g" ? num * 1024 ** 3 : num * 1024 ** 2;
}

interface ContainerInfo {
  containerId: string;
  mrIid: number;
  branch: string;
  slot: number;
  createdAt: number;
}

const containers = new Map<number, ContainerInfo>();

export const dockerManager = {
  async createContainer(mrIid: number, branch: string): Promise<ContainerInfo> {
    const existing = containers.get(mrIid);
    if (existing) return existing;

    if (containers.size >= config.maxContainers) {
      throw new Error("Max containers reached");
    }

    const slot = portAllocator.allocateSlot();
    if (slot === null) {
      throw new Error("No available slots");
    }

    const previewPort = portAllocator.getPreviewPort(slot);
    const ttydPort = portAllocator.getTtydPort(slot);
    const now = Date.now();

    try {
      const container = await docker.createContainer({
        Image: config.reviewImage,
        Env: [
          `BRANCH=${branch}`,
          `GITLAB_URL=${config.gitlabUrl}`,
          `GITLAB_PAT=${config.gitlabPat}`,
          `PROJECT_PATH=${config.gitlabProjectPath}`,
          `GIT_USER_NAME=${config.gitUserName}`,
          `GIT_USER_EMAIL=${config.gitUserEmail}`,
          `APP_PORT=${config.appPort}`,
          `ANTHROPIC_AUTH_TOKEN=${config.anthropicAuthToken}`,
          `ANTHROPIC_BASE_URL=${config.anthropicBaseUrl}`,
          `ANTHROPIC_MODEL=${config.anthropicModel}`,
        ],
        Labels: {
          [LABEL_PREFIX]: "true",
          [`${LABEL_PREFIX}.mr_iid`]: String(mrIid),
          [`${LABEL_PREFIX}.branch`]: branch,
          [`${LABEL_PREFIX}.slot`]: String(slot),
          [`${LABEL_PREFIX}.created_at`]: String(now),
        },
        ExposedPorts: {
          "7681/tcp": {},
          [`${config.appPort}/tcp`]: {},
        },
        HostConfig: {
          PortBindings: {
            "7681/tcp": [
              { HostIp: "127.0.0.1", HostPort: String(ttydPort) },
            ],
            [`${config.appPort}/tcp`]: [
              { HostIp: "127.0.0.1", HostPort: String(previewPort) },
            ],
          },
          NanoCpus: config.containerCpuLimit * 1e9,
          Memory: parseMemory(config.containerMemoryLimit),
        },
        name: `review-env-mr-${mrIid}`,
      });

      await container.start();

      const info: ContainerInfo = {
        containerId: container.id,
        mrIid,
        branch,
        slot,
        createdAt: now,
      };
      containers.set(mrIid, info);
      return info;
    } catch (err) {
      portAllocator.releaseSlot(slot);
      throw err;
    }
  },

  async stopContainer(mrIid: number): Promise<boolean> {
    const info = containers.get(mrIid);
    if (!info) return false;

    try {
      const container = docker.getContainer(info.containerId);
      await container.stop().catch(() => {});
      await container.remove({ force: true });
    } catch {
      // container may not exist anymore
    }

    portAllocator.releaseSlot(info.slot);
    containers.delete(mrIid);
    return true;
  },

  async getContainerStatus(
    mrIid: number
  ): Promise<{
    status: "not_found" | "creating" | "initializing" | "ready" | "error";
    message?: string;
    previewPort?: number;
    ttydPort?: number;
  }> {
    const info = containers.get(mrIid);
    if (!info) return { status: "not_found" };

    try {
      const container = docker.getContainer(info.containerId);
      const exec = await container.exec({
        Cmd: ["cat", "/tmp/review-status"],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ Detach: false, Tty: false });

      const output = await new Promise<string>((resolve) => {
        const chunks: Buffer[] = [];
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString().trim()));
        setTimeout(() => resolve(""), 3000);
      });

      const cleaned = output.replace(/[\x00-\x08]/g, "").trim();

      if (cleaned.startsWith("ready")) {
        return {
          status: "ready",
          previewPort: portAllocator.getPreviewPort(info.slot),
          ttydPort: portAllocator.getTtydPort(info.slot),
          message: cleaned,
        };
      }
      if (cleaned.startsWith("error")) {
        return { status: "error", message: cleaned };
      }
      if (cleaned === "cloning" || cleaned === "installing") {
        return { status: "initializing", message: cleaned };
      }
      return { status: "creating" };
    } catch {
      return { status: "creating" };
    }
  },

  async recoverState(): Promise<void> {
    const allContainers = await docker.listContainers({
      all: true,
      filters: { label: [LABEL_PREFIX] },
    });

    const recoveredSlots: number[] = [];

    for (const c of allContainers) {
      const labels = c.Labels;
      const mrIid = Number(labels[`${LABEL_PREFIX}.mr_iid`]);
      const branch = labels[`${LABEL_PREFIX}.branch`] || "";
      const slot = Number(labels[`${LABEL_PREFIX}.slot`]);
      const createdAt = Number(labels[`${LABEL_PREFIX}.created_at`]) || Date.now();

      if (!mrIid || isNaN(slot)) continue;

      containers.set(mrIid, {
        containerId: c.Id,
        mrIid,
        branch,
        slot,
        createdAt,
      });
      recoveredSlots.push(slot);
    }

    portAllocator.recoverSlots(recoveredSlots);
    console.log(`Recovered ${allContainers.length} containers`);
  },

  async cleanupExpired(): Promise<void> {
    const timeoutMs = config.containerTimeoutHours * 60 * 60 * 1000;
    const now = Date.now();

    for (const [mrIid, info] of containers) {
      if (now - info.createdAt > timeoutMs) {
        console.log(`Cleaning up expired container for MR ${mrIid}`);
        await this.stopContainer(mrIid);
      }
    }
  },

  getInfo(mrIid: number): ContainerInfo | undefined {
    return containers.get(mrIid);
  },

  activeCount(): number {
    return containers.size;
  },
};
