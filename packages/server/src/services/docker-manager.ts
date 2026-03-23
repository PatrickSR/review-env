import Docker from "dockerode";
import { config } from "../config.js";
import { containersDb } from "../db/containers.js";
import { testContainersDb } from "../db/test-containers.js";
import { projectImagesDb, type ProjectImage } from "../db/project-images.js";
import { type Project } from "../db/projects.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("docker");
const docker = new Docker();

const NETWORK_NAME = "review-net";

function parseMemory(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(g|m)$/i);
  if (!match) return 4 * 1024 * 1024 * 1024;
  const num = parseFloat(match[1]!);
  return match[2]!.toLowerCase() === "g" ? num * 1024 ** 3 : num * 1024 ** 2;
}

async function ensureNetwork(): Promise<void> {
  const networks = await docker.listNetworks({
    filters: { name: [NETWORK_NAME] },
  });
  const exists = networks.some((n) => n.Name === NETWORK_NAME);
  if (!exists) {
    await docker.createNetwork({ Name: NETWORK_NAME, Driver: "bridge" });
    log.info(`Created network: ${NETWORK_NAME}`);
  }
}

async function inspectPorts(containerId: string): Promise<Record<number, number>> {
  const container = docker.getContainer(containerId);
  const info = await container.inspect();
  const portBindings = info.NetworkSettings?.Ports || {};
  const ports: Record<number, number> = {};

  for (const [containerPort, bindings] of Object.entries(portBindings)) {
    if (!bindings || bindings.length === 0) continue;
    const port = parseInt(containerPort);
    const hostPort = parseInt(bindings[0]!.HostPort || "0");
    if (port && hostPort) {
      ports[port] = hostPort;
    }
  }
  return ports;
}

export interface CreateContainerParams {
  project: Project;
  imageId: number;
  mrIid: number;
  branch: string;
}

export const dockerManager = {
  async createContainer(params: CreateContainerParams) {
    const { project, imageId, mrIid, branch } = params;
    const projectId = project.gitlab_project_id;

    // Check max containers
    const activeCount = containersDb.countActive();
    if (activeCount >= config.maxContainers) {
      throw new Error("Max containers reached");
    }

    // Get image config
    const imageConfig = projectImagesDb.getById(imageId);
    if (!imageConfig || imageConfig.project_id !== project.id) {
      throw new Error("Image not found or does not belong to this project");
    }
    if (!imageConfig.enabled) {
      throw new Error("Image is disabled");
    }

    // Destroy existing container for this project+MR if any
    await this.stopContainer(project.id, projectId, mrIid);

    await ensureNetwork();

    const containerName = `review-env-${projectId}-mr-${mrIid}`;

    // Parse extra env vars from image config
    let extraEnvVars: Record<string, string> = {};
    try {
      extraEnvVars = JSON.parse(imageConfig.env_vars);
    } catch { /* ignore */ }

    const envList = [
      `BRANCH=${branch}`,
      `GITLAB_URL=${project.gitlab_url}`,
      `GITLAB_PAT=${project.gitlab_pat}`,
      `PROJECT_PATH=${project.project_path}`,
      `GIT_USER_NAME=${project.git_user_name}`,
      `GIT_USER_EMAIL=${project.git_user_email}`,
      ...Object.entries(extraEnvVars).map(([k, v]) => `${k}=${v}`),
    ];

    // ttyd (7681) is NOT mapped to host
    const exposedPorts: Record<string, object> = { "7681/tcp": {} };
    const portBindings: Record<string, object[]> = {};

    const container = await docker.createContainer({
      Image: imageConfig.image,
      Env: envList,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        NetworkMode: NETWORK_NAME,
        NanoCpus: config.containerCpuLimit * 1e9,
        Memory: parseMemory(config.containerMemoryLimit),
      },
      name: containerName,
    });

    await container.start();

    const ports = await inspectPorts(container.id);

    const record = containersDb.create({
      project_id: project.id,
      mr_iid: mrIid,
      branch,
      image_id: imageId,
      container_id: container.id,
      ports: JSON.stringify(ports),
    });

    log.info(`Created container ${containerName} (image: ${imageConfig.display_name}) for MR ${mrIid}`);
    return record;
  },

  async stopContainer(internalProjectId: number, gitlabProjectId: number, mrIid: number): Promise<boolean> {
    const record = containersDb.getByProjectAndMr(internalProjectId, mrIid);
    if (!record) return false;

    try {
      const container = docker.getContainer(record.container_id);
      await container.stop().catch(() => {});
      await container.remove({ force: true });
    } catch {
      // container may not exist anymore
    }

    containersDb.delete(record.id);
    log.info(`Stopped container for project ${gitlabProjectId} MR ${mrIid}`);
    return true;
  },

  async stopContainerById(id: number): Promise<boolean> {
    const record = containersDb.getById(id);
    if (!record) return false;

    try {
      const container = docker.getContainer(record.container_id);
      await container.stop().catch(() => {});
      await container.remove({ force: true });
    } catch { /* ignore */ }

    containersDb.delete(record.id);
    log.info(`Stopped container id=${id}`);
    return true;
  },

  async getContainerStatus(
    internalProjectId: number,
    mrIid: number
  ): Promise<{
    status: "not_found" | "creating" | "initializing" | "ready" | "error";
    message?: string;
    ports?: Record<number, number>;
    image_id?: number;
    display_name?: string;
  }> {
    const record = containersDb.getByProjectAndMr(internalProjectId, mrIid);
    if (!record) return { status: "not_found" };

    // Get image info
    const imageConfig = projectImagesDb.getById(record.image_id);

    try {
      const container = docker.getContainer(record.container_id);
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
      const ports: Record<number, number> = JSON.parse(record.ports || "{}");

      if (cleaned.startsWith("ready")) {
        return {
          status: "ready",
          ports,
          message: cleaned,
          image_id: record.image_id,
          display_name: imageConfig?.display_name,
        };
      }
      if (cleaned.startsWith("error")) {
        return { status: "error", message: cleaned, image_id: record.image_id, display_name: imageConfig?.display_name };
      }
      if (cleaned === "cloning" || cleaned === "installing") {
        return { status: "initializing", message: cleaned, image_id: record.image_id, display_name: imageConfig?.display_name };
      }
      return { status: "creating", image_id: record.image_id, display_name: imageConfig?.display_name };
    } catch {
      return { status: "creating", image_id: record.image_id, display_name: imageConfig?.display_name };
    }
  },

  async recoverState(): Promise<void> {
    await ensureNetwork();

    const records = containersDb.getAll();
    let cleaned = 0;

    for (const record of records) {
      try {
        const container = docker.getContainer(record.container_id);
        const info = await container.inspect();
        // Update ports from actual state
        const ports = await inspectPorts(record.container_id);
        containersDb.updatePorts(record.id, JSON.stringify(ports));
      } catch {
        // Container doesn't exist in Docker, remove DB record
        containersDb.delete(record.id);
        cleaned++;
      }
    }

    // Recover test containers
    const testRecords = testContainersDb.getAll();
    let testCleaned = 0;

    for (const record of testRecords) {
      try {
        const container = docker.getContainer(record.container_id);
        await container.inspect();
      } catch {
        testContainersDb.delete(record.id);
        testCleaned++;
      }
    }

    log.info(`State recovery: ${records.length} review records (${cleaned} cleaned), ${testRecords.length} test records (${testCleaned} cleaned)`);
  },

  async cleanupExpired(): Promise<void> {
    const timeoutSeconds = config.containerTimeoutHours * 60 * 60;
    const expired = containersDb.getExpired(timeoutSeconds);

    for (const record of expired) {
      log.info(`Cleaning up expired container id=${record.id} for MR ${record.mr_iid}`);
      await this.stopContainerById(record.id);
    }

    // Cleanup expired test containers
    const testTimeoutSeconds = config.testContainerTimeoutMinutes * 60;
    const expiredTest = testContainersDb.getExpired(testTimeoutSeconds);

    for (const record of expiredTest) {
      log.info(`Cleaning up expired test container id=${record.id} (image: ${record.image})`);
      try {
        const container = docker.getContainer(record.container_id);
        await container.stop().catch(() => {});
        await container.remove({ force: true });
      } catch { /* container may already be gone */ }
      testContainersDb.delete(record.id);
    }
  },
};
