import type { Express } from "express";
import type { Server } from "node:http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { projectsDb } from "../db/projects.js";
import { containersDb } from "../db/containers.js";

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

  const proxy = createProxyMiddleware({
    target: fallback,
    changeOrigin: true,
    ws: true,
    router: (req) => {
      const url = req.url || (req as any).originalUrl || "";
      const ids = extractIds(url);
      if (!ids) return fallback;
      return getTarget(ids.projectId, ids.mrIid) || fallback;
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
  }, proxy);

  server.on("upgrade", (req, socket, head) => {
    const url = req.url || "";
    if (url.match(/^\/mr\/\d+\/\d+\/terminal/)) {
      const ids = extractIds(url);
      if (ids && getTarget(ids.projectId, ids.mrIid)) {
        proxy.upgrade(req, socket as any, head);
      } else {
        socket.destroy();
      }
    }
  });
}
