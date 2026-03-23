import type { Express } from "express";
import type { Server } from "node:http";
import { createProxyMiddleware } from "http-proxy-middleware";
import httpProxy from "http-proxy";
import { projectsDb } from "../db/projects.js";
import { containersDb } from "../db/containers.js";
import { testContainersDb } from "../db/test-containers.js";
import { config } from "../config.js";

function extractIds(url: string): { projectId: number; mrIid: number } | null {
  const match = url.match(/^\/mr\/(\d+)\/(\d+)\/terminal/);
  if (!match) return null;
  return { projectId: Number(match[1]), mrIid: Number(match[2]) };
}

function getTarget(projectId: number, mrIid: number): string | null {
  const project = projectsDb.getByGitlabProjectId(projectId);
  if (!project) return null;
  const record = containersDb.getByProjectAndMr(project.id, mrIid);
  if (!record) return null;
  return `http://review-env-${projectId}-mr-${mrIid}:7681`;
}

export function setupTtydProxy(app: Express, server: Server): void {
  const fallback = "http://127.0.0.1:7000";

  // --- MR terminal proxy (HTTP only) ---
  const mrProxy = createProxyMiddleware({
    target: fallback,
    changeOrigin: true,
    router: (req) => {
      const url = (req as any).originalUrl || req.url || "";
      const ids = extractIds(url);
      console.log("[DEBUG proxy] router url:", url, "ids:", ids, "req.url:", req.url, "req.originalUrl:", (req as any).originalUrl);
      if (!ids) return fallback;
      const target = getTarget(ids.projectId, ids.mrIid) || fallback;
      console.log("[DEBUG proxy] target:", target);
      return target;
    },
    pathRewrite: (path) => {
      const match = path.match(/^\/mr\/\d+\/\d+\/terminal(\/.*)?$/);
      return match?.[1] || "/";
    },
    on: {
      error: (_err, _req, res) => {
        if ("writeHead" in res) {
          (res as any).writeHead(502, { "Content-Type": "text/plain" });
          (res as any).end("ttyd not available");
        }
      },
    },
  });

  app.use("/mr/:projectId/:mrIid/terminal", (req, _res, next) => {
    const projectId = Number(req.params.projectId);
    const mrIid = Number(req.params.mrIid);
    const project = projectsDb.getByGitlabProjectId(projectId);
    if (!project) {
      _res.status(404).send("Project not found");
      return;
    }
    const record = containersDb.getByProjectAndMr(project.id, mrIid);
    if (!record) {
      _res.status(404).send("Container not found");
      return;
    }
    next();
  }, mrProxy);

  // --- Test container terminal proxy (HTTP only) ---
  const testProxy = createProxyMiddleware({
    target: fallback,
    changeOrigin: true,
    router: (req) => {
      const url = (req as any).originalUrl || req.url || "";
      const match = url.match(/\/api\/docker\/test\/([^/]+)\/terminal/);
      if (!match) return fallback;
      const containerId = match[1];
      const records = testContainersDb.getAll();
      const entry = records.find((r) => r.container_id === containerId);
      if (!entry) return fallback;
      return `http://${config.dockerHostIp}:${entry.host_port}`;
    },
    pathRewrite: (_path, req) => {
      const original = (req as any).originalUrl || _path;
      const match = original.match(/\/api\/docker\/test\/[^/]+\/terminal(\/.*)?$/);
      return match?.[1] || "/";
    },
    on: {
      error: (_err, _req, res) => {
        if ("writeHead" in res) {
          (res as any).writeHead(502, { "Content-Type": "text/plain" });
          (res as any).end("ttyd not available");
        }
      },
    },
  });

  app.use("/api/docker/test/:containerId/terminal", (req, _res, next) => {
    const { containerId } = req.params;
    const records = testContainersDb.getAll();
    const entry = records.find((r) => r.container_id === containerId);
    if (!entry) {
      _res.status(404).send("Test container not found");
      return;
    }
    next();
  }, testProxy);

  // --- WebSocket upgrade (raw http-proxy, no http-proxy-middleware) ---
  // Using http-proxy directly avoids the wsInternalSubscribed no-op issue
  // in http-proxy-middleware's .upgrade() method.
  const wsProxy = httpProxy.createProxyServer({});
  wsProxy.on("error", (err, _req, res) => {
    if ("destroy" in res) (res as any).destroy();
  });

  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";

    if (url.match(/^\/mr\/\d+\/\d+\/terminal/)) {
      const ids = extractIds(url);
      if (!ids) { socket.destroy(); return; }
      const target = getTarget(ids.projectId, ids.mrIid);
      if (!target) { socket.destroy(); return; }
      // Rewrite path: /mr/123/456/terminal/ws -> /ws
      const subPath = url.replace(/^\/mr\/\d+\/\d+\/terminal/, "") || "/";
      req.url = subPath;
      wsProxy.ws(req, socket, head, { target, changeOrigin: true });
    } else if (url.match(/^\/api\/docker\/test\/[^/]+\/terminal/)) {
      const match = url.match(/\/api\/docker\/test\/([^/]+)\/terminal/);
      if (!match) { socket.destroy(); return; }
      const records = testContainersDb.getAll();
      const entry = records.find((r) => r.container_id === match[1]);
      if (!entry) { socket.destroy(); return; }
      const target = `http://${config.dockerHostIp}:${entry.host_port}`;
      // Rewrite path: /api/docker/test/<id>/terminal/ws -> /ws
      const subPath = url.replace(/^\/api\/docker\/test\/[^/]+\/terminal/, "") || "/";
      req.url = subPath;
      wsProxy.ws(req, socket, head, { target, changeOrigin: true });
    }
    // Other upgrade requests (e.g. Vite HMR) are ignored - let them pass through
  });
}
