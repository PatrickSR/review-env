import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dockerManager } from "../services/docker-manager.js";
import { gitlabApi } from "../services/gitlab-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const terminalHtmlPath = path.join(__dirname, "../../public/terminal.html");

export const terminalRouter = Router();

// Terminal page
terminalRouter.get("/mr/:id", async (req, res) => {
  const mrIid = Number(req.params.id);
  if (!mrIid) {
    res.status(400).send("Invalid MR ID");
    return;
  }

  // Auto-create container if not exists
  const info = dockerManager.getInfo(mrIid);
  if (!info) {
    try {
      const mrInfo = await gitlabApi.getMrInfo(mrIid);
      await dockerManager.createContainer(mrIid, mrInfo.source_branch);
    } catch (err: any) {
      if (err.message === "Max containers reached" || err.message === "No available slots") {
        res.type("html").send(
          `<html><body style="background:#1e1e1e;color:#f55;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h2>资源不足：当前容器数已达上限，请稍后再试</h2></body></html>`
        );
        return;
      }
      res.status(500).send(`Error: ${err.message}`);
      return;
    }
  }

  res.sendFile(terminalHtmlPath);
});

// Terminal status API
terminalRouter.get("/mr/:id/status", async (req, res) => {
  const mrIid = Number(req.params.id);
  if (!mrIid) {
    res.json({ status: "not_found" });
    return;
  }

  const status = await dockerManager.getContainerStatus(mrIid);
  res.json(status);
});
