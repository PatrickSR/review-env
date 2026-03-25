import { Router } from "express";
import Docker from "dockerode";
import { createLogger } from "../utils/logger.js";
import { testContainersDb } from "../db/test-containers.js";

const log = createLogger("docker-api");
const docker = new Docker();

export const dockerRouter = Router();

export interface DockerImageInfo {
  id: string;
  name: string;
  tag: string;
  size: number;
  created: number;
}

// --- List images ---

dockerRouter.get("/images", async (_req, res) => {
  try {
    const images = await docker.listImages({ all: false });
    const result: DockerImageInfo[] = [];

    for (const img of images) {
      const tags = img.RepoTags || [];
      if (tags.length === 0 || (tags.length === 1 && tags[0] === "<none>:<none>")) {
        continue; // skip dangling
      }

      for (const tag of tags) {
        if (tag === "<none>:<none>") continue;
        const [name, tagName] = tag.split(":");
        result.push({
          id: img.Id,
          name: name || tag,
          tag: tagName || "latest",
          size: img.Size,
          created: img.Created,
        });
      }
    }

    res.json(result);
  } catch (err: any) {
    log.error("Failed to list images", err);
    res.status(500).json({ error: err.message });
  }
});


// --- Delete image ---

dockerRouter.delete("/images/:id", async (req, res) => {
  const imageId = decodeURIComponent(req.params.id);

  try {
    const image = docker.getImage(imageId);

    // Try to remove
    await image.remove();
    log.info(`Deleted image: ${imageId}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err.statusCode === 409) {
      res.status(409).json({ error: "Image is in use by a container" });
      return;
    }
    if (err.statusCode === 404) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    log.error("Failed to delete image", err);
    res.status(500).json({ error: err.message });
  }
});

import { Readable } from "node:stream";

// --- Build image (SSE) ---

dockerRouter.post("/build", async (req, res) => {
  const { dockerfile, name, tag } = req.body;

  if (!dockerfile || !name) {
    res.status(400).json({ error: "Missing required fields: dockerfile, name" });
    return;
  }

  const imageTag = tag || "latest";
  const imageName = `${name}:${imageTag}`;

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent("log", { message: `Building image ${imageName}...` });

    // Create tar stream with user-provided Dockerfile
    const tarStream = createTarStream({
      "Dockerfile": dockerfile,
    });

    const buildStream = await docker.buildImage(tarStream, {
      t: imageName,
    });

    // Parse Docker build output
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(
        buildStream,
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        },
        (event: any) => {
          if (event.stream) {
            const line = event.stream.replace(/\n$/, "");
            if (line) sendEvent("log", { message: line });
          }
          if (event.error) {
            sendEvent("error", { message: event.error });
          }
        }
      );
    });

    // Get final image info
    const image = docker.getImage(imageName);
    const info = await image.inspect();

    sendEvent("complete", {
      imageName,
      size: info.Size,
    });

    log.info(`Built image: ${imageName}`);
  } catch (err: any) {
    log.error("Build failed", err);
    sendEvent("error", { message: err.message || "Build failed" });
  } finally {
    res.end();
  }
});

/**
 * Create a minimal tar archive from a map of filename -> content.
 * Uses raw tar format (512-byte headers + padded content).
 */
function createTarStream(files: Record<string, string>): Readable {
  const buffers: Buffer[] = [];

  for (const [name, content] of Object.entries(files)) {
    const contentBuf = Buffer.from(content, "utf-8");
    const header = Buffer.alloc(512, 0);

    // File name
    header.write(name, 0, 100, "utf-8");
    // File mode
    header.write("0000755\0", 100, 8, "utf-8");
    // Owner/group ID
    header.write("0000000\0", 108, 8, "utf-8");
    header.write("0000000\0", 116, 8, "utf-8");
    // File size (octal)
    header.write(contentBuf.length.toString(8).padStart(11, "0") + "\0", 124, 12, "utf-8");
    // Modification time
    header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, "0") + "\0", 136, 12, "utf-8");
    // Type flag (regular file)
    header.write("0", 156, 1, "utf-8");
    // Checksum placeholder (spaces)
    header.write("        ", 148, 8, "utf-8");

    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += header[i]!;
    header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "utf-8");

    buffers.push(header);
    buffers.push(contentBuf);

    // Pad to 512-byte boundary
    const padding = 512 - (contentBuf.length % 512);
    if (padding < 512) buffers.push(Buffer.alloc(padding, 0));
  }

  // End-of-archive marker (two 512-byte zero blocks)
  buffers.push(Buffer.alloc(1024, 0));

  return Readable.from(Buffer.concat(buffers));
}


// --- Test containers ---

const NETWORK_NAME = "review-net";

async function ensureNetwork(): Promise<void> {
  const networks = await docker.listNetworks({ filters: { name: [NETWORK_NAME] } });
  const exists = networks.some((n) => n.Name === NETWORK_NAME);
  if (!exists) {
    await docker.createNetwork({ Name: NETWORK_NAME, Driver: "bridge" });
  }
}

dockerRouter.post("/test", async (req, res) => {
  const { image } = req.body;

  if (!image) {
    res.status(400).json({ error: "Missing required field: image" });
    return;
  }

  try {
    await ensureNetwork();

    const existing = testContainersDb.getOne();

    if (existing) {
      if (existing.image === image) {
        // Same image — check if Docker container is alive
        try {
          const container = docker.getContainer(existing.container_id);
          await container.inspect();
          // Alive — reuse and refresh last_accessed_at
          testContainersDb.updateLastAccessed(existing.id);
          log.info(`Reusing test container: ${existing.container_name} (image: ${image})`);
          res.json({
            containerId: existing.container_id,
            containerName: existing.container_name,
            image: existing.image,
          });
          return;
        } catch {
          // Dead — clean up DB record and create new
          testContainersDb.delete(existing.id);
          log.info(`Test container dead, cleaning up: ${existing.container_id.slice(0, 12)}`);
        }
      } else {
        // Different image — destroy old container first
        try {
          const container = docker.getContainer(existing.container_id);
          await container.stop().catch(() => {});
          await container.remove({ force: true });
        } catch { /* container may already be gone */ }
        testContainersDb.delete(existing.id);
        log.info(`Replaced test container (old image: ${existing.image}, new: ${image})`);
      }
    }

    // Create new test container
    const containerName = `review-test-${Date.now()}`;

    const container = await docker.createContainer({
      Image: image,
      name: containerName,
      ExposedPorts: { "7681/tcp": {} },
      HostConfig: {
        NetworkMode: NETWORK_NAME,
        PortBindings: { "7681/tcp": [{ HostPort: "0" }] },
      },
    });

    await container.start();

    const containerId = container.id;

    // Get the assigned host port
    const inspectInfo = await container.inspect();
    const portBindings = inspectInfo.NetworkSettings?.Ports?.["7681/tcp"];
    const hostPort = portBindings?.[0]?.HostPort;
    if (!hostPort) {
      await container.stop().catch(() => {});
      await container.remove({ force: true });
      res.status(500).json({ error: "Failed to get mapped port" });
      return;
    }

    testContainersDb.create({
      container_id: containerId,
      container_name: containerName,
      image,
      host_port: Number(hostPort),
    });

    log.info(`Test container started: ${containerName} (image: ${image})`);

    res.json({
      containerId,
      containerName,
      image,
    });
  } catch (err: any) {
    log.error("Failed to start test container", err);
    res.status(500).json({ error: err.message });
  }
});

// --- Stop test container ---

dockerRouter.delete("/test/:containerId", async (req, res) => {
  const { containerId } = req.params;

  try {
    try {
      const container = docker.getContainer(containerId);
      await container.stop().catch(() => {});
      await container.remove({ force: true });
    } catch { /* container may already be gone */ }
    testContainersDb.deleteByContainerId(containerId);
    log.info(`Test container cleaned up: ${containerId.slice(0, 12)}`);
    res.json({ success: true });
  } catch (err: any) {
    log.error("Failed to stop test container", err);
    res.status(500).json({ error: err.message });
  }
});

// --- List test containers ---

dockerRouter.get("/test", (_req, res) => {
  const records = testContainersDb.getAll();
  const result = records.map((tc) => ({
    containerId: tc.container_id,
    image: tc.image,
    createdAt: tc.created_at,
  }));
  res.json(result);
});


