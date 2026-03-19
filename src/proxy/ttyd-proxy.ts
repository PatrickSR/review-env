import type { Express } from "express";
import type { Server } from "node:http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { dockerManager } from "../services/docker-manager.js";

function extractMrIid(url: string): number | null {
  const match = url.match(/^\/mr\/(\d+)\/terminal/);
  return match ? Number(match[1]) : null;
}

function getTarget(mrIid: number): string | null {
  const info = dockerManager.getInfo(mrIid);
  if (!info) return null;
  return `http://review-env-mr-${mrIid}:7681`;
}

export function setupTtydProxy(app: Express, server: Server): void {
  const fallback = "http://127.0.0.1:7000";

  const proxy = createProxyMiddleware({
    target: fallback,
    changeOrigin: true,
    ws: true,
    router: (req) => {
      const url = req.url || (req as any).originalUrl || "";
      const mrIid = extractMrIid(url);
      if (!mrIid) return fallback;
      return getTarget(mrIid) || fallback;
    },
    pathRewrite: (path) => {
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

  app.use("/mr/:id/terminal", (req, _res, next) => {
    const mrIid = Number(req.params.id);
    const info = dockerManager.getInfo(mrIid);
    if (!info) {
      _res.status(404).send("Container not found");
      return;
    }
    next();
  }, proxy);

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
