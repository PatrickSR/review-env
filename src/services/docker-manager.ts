import Docker from "dockerode";
import { config } from "../config.js";

const docker = new Docker();

const LABEL_PREFIX = "review-env";
const NETWORK_NAME = "review-net";

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
  createdAt: number;
  ports: Record<number, number>; // container port -> host port
}

const containers = new Map<number, ContainerInfo>();

async function ensureNetwork(): Promise<void> {
  const networks = await docker.listNetworks({
    filters: { name: [NETWORK_NAME] },
  });
  const exists = networks.some((n) => n.Name === NETWORK_NAME);
  if (!exists) {
    await docker.createNetwork({ Name: NETWORK_NAME, Driver: "bridge" });
    console.log(`Created network: ${NETWORK_NAME}`);
  }
}

async function inspectPorts(containerId: string): Promise<Record<number, number>> {
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  const portBindings = info.NetworkSettings?.Ports || {};
  const ports: Record<number, number> = {};

  for (const [containerPort, bindings] of Object.entries(portBindings)) {
    if (!bindings || bindings.length === 0) continue;
    const port = parseInt(containerPort); // e.g. "3000/tcp" -> 3000
    const hostPort = parseInt(bindings[0]!.HostPort || "0");
    if (port && hostPort) {
      ports[port] = hostPort;
    }
  }

  return ports;
}

export const dockerManager = {
  async createContainer(mrIid: number, branch: string): Promise<ContainerInfo> {
    const existing = containers.get(mrIid);
    if (existing) return existing;

    if (containers.size >= config.maxContainers) {
      throw new Error("Max containers reached");
    }

    await ensureNetwork();

    const now = Date.now();

    // Build ExposedPorts and PortBindings for app ports (random host mapping)
    // ttyd (7681) is NOT mapped to host - accessed via Docker network
    const exposedPorts: Record<string, object> = { "7681/tcp": {} };
    const portBindings: Record<string, object[]> = {};

    for (const port of config.appPorts) {
      exposedPorts[`${port}/tcp`] = {};
      portBindings[`${port}/tcp`] = [{ HostPort: "" }]; // random host port
    }

    const container = await docker.createContainer({
      Image: config.reviewImage,
      Env: [
        `BRANCH=${branch}`,
        `GITLAB_URL=${config.gitlabUrl}`,
        `GITLAB_PAT=${config.gitlabPat}`,
        `PROJECT_PATH=${config.gitlabProjectPath}`,
        `GIT_USER_NAME=${config.gitUserName}`,
        `GIT_USER_EMAIL=${config.gitUserEmail}`,
        `APP_PORT=${config.appPorts[0] || 7702}`,
        `ANTHROPIC_AUTH_TOKEN=${config.anthropicAuthToken}`,
        `ANTHROPIC_BASE_URL=${config.anthropicBaseUrl}`,
        `ANTHROPIC_MODEL=${config.anthropicModel}`,
      ],
      Labels: {
        [LABEL_PREFIX]: "true",
        [`${LABEL_PREFIX}.mr_iid`]: String(mrIid),
        [`${LABEL_PREFIX}.branch`]: branch,
        [`${LABEL_PREFIX}.created_at`]: String(now),
      },
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        NetworkMode: NETWORK_NAME,
        NanoCpus: config.containerCpuLimit * 1e9,
        Memory: parseMemory(config.containerMemoryLimit),
      },
      name: `review-env-mr-${mrIid}`,
    });

    await container.start();

    const ports = await inspectPorts(container.id);

    const info: ContainerInfo = {
      containerId: container.id,
      mrIid,
      branch,
      createdAt: now,
      ports,
    };
    containers.set(mrIid, info);
    return info;
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

    containers.delete(mrIid);
    return true;
  },

  async getContainerStatus(
    mrIid: number
  ): Promise<{
    status: "not_found" | "creating" | "initializing" | "ready" | "error";
    message?: string;
    ports?: Record<number, number>;
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
          ports: info.ports,
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
    await ensureNetwork();

    const allContainers = await docker.listContainers({
      all: true,
      filters: { label: [LABEL_PREFIX] },
    });

    for (const c of allContainers) {
      const labels = c.Labels;
      const mrIid = Number(labels[`${LABEL_PREFIX}.mr_iid`]);
      const branch = labels[`${LABEL_PREFIX}.branch`] || "";
      const createdAt = Number(labels[`${LABEL_PREFIX}.created_at`]) || Date.now();

      if (!mrIid) continue;

      const ports = await inspectPorts(c.Id);

      containers.set(mrIid, {
        containerId: c.Id,
        mrIid,
        branch,
        createdAt,
        ports,
      });
    }

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
