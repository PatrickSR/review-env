import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { dockerManager } from "../services/docker-manager.js";
import { portAllocator } from "../services/port-allocator.js";

export const previewRouter = Router();

previewRouter.use("/mr/:id/preview", (req, res, next) => {
  const mrIid = Number(req.params.id);
  const info = dockerManager.getInfo(mrIid);

  if (!info) {
    res.status(404).type("html").send(
      `<html><body style="background:#1e1e1e;color:#ccc;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h2>容器不存在</h2></body></html>`
    );
    return;
  }

  const port = portAllocator.getPreviewPort(info.slot);
  const target = `http://127.0.0.1:${port}`;

  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (_path, req) => {
      // Strip /mr/:id/preview prefix
      const originalUrl = req.originalUrl || req.url || "";
      const match = originalUrl.match(/^\/mr\/\d+\/preview(\/.*)?$/);
      return match?.[1] || "/";
    },
    on: {
      error: (_err, _req, res) => {
        if ("writeHead" in res) {
          (res as any).writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
          (res as any).end(
            `<html><body style="background:#1e1e1e;color:#f55;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h2>无法连接到 dev server（端口 ${port}），请确认已启动</h2></body></html>`
          );
        }
      },
    },
  });

  proxy(req, res, next);
});
