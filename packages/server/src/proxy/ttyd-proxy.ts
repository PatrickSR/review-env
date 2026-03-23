import type { Express } from "express";
import type { Server } from "node:http";
import { createProxyMiddleware } from "http-proxy-middleware";
import httpProxy from "http-proxy";
import { testContainersDb } from "../db/test-containers.js";
import { config } from "../config.js";

export function setupTtydProxy(app: Express, server: Server): void {
  const fallback = "http://127.0.0.1:7000";

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

    if (url.match(/^\/api\/docker\/test\/[^/]+\/terminal/)) {
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
