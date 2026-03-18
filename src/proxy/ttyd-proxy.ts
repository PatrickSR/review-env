import type { Express } from "express";
import type { Server } from "node:http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { dockerManager } from "../services/docker-manager.js";
import { portAllocator } from "../services/port-allocator.js";

function extractMrIid(url: string): number | null {
  const match = url.match(/^\/mr\/(\d+)\/terminal/);
  return match ? Number(match[1]) : null;
}

function getTarget(mrIid: number): string | null {
  const info = dockerManager.getInfo(mrIid);
  if (!info) return null;
  const ttydPort = portAllocator.getTtydPort(info.slot);
  return `http://127.0.0.1:${ttydPort}`;
}

export function setupTtydProxy(app: Express, server: Server): void {
  const proxy = createProxyMiddleware({
    // Default target (overridden by router)
    target: "http://127.0.0.1:7000",
    changeOrigin: true,
    ws: true,
    router: (req) => {
      const url = req.url || (req as any).originalUrl || "";
      const mrIid = extractMrIid(url);
      if (!mrIid) return "http://127.0.0.1:7000";
      return getTarget(mrIid) || "http://127.0.0.1:7000";
    },
    pathRewrite: (path) => {
      // Strip /mr/:id/terminal prefix
      const match = path.match(/^\/mr\/\d+\/terminal(\/.*)?$/);
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

  // HTTP requests
  app.use("/mr/:id/terminal", (req, _res, next) => {
    const mrIid = Number(req.params.id);
    const info = dockerManager.getInfo(mrIid);
    if (!info) {
      _res.status(404).send("Container not found");
      return;
    }
    next();
  }, proxy);

  // WebSocket upgrade
  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (url.match(/^\/mr\/\d+\/terminal/)) {
      const mrIid = extractMrIid(url);
      if (mrIid && dockerManager.getInfo(mrIid)) {
        proxy.upgrade(req, socket as any, head);
      } else {
        socket.destroy();
      }
    }
  });
}
