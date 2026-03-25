import { Router } from "express";
import { config } from "../config.js";
import { projectsDb } from "../db/projects.js";
import { containersDb } from "../db/containers.js";
import { dockerManager } from "../services/docker-manager.js";
import { gitlabApi } from "../services/gitlab-api.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("webhook");

export const webhookRouter = Router();

function getServiceUrl(): string {
  return `http://localhost:${config.port}`;
}

webhookRouter.post("/webhook/:projectId", async (req, res) => {
  const gitlabProjectId = Number(req.params.projectId);
  if (!gitlabProjectId) {
    res.status(400).send("Invalid project ID");
    return;
  }

  const project = projectsDb.getByGitlabProjectId(gitlabProjectId);
  if (!project) {
    res.status(404).send("Project not found");
    return;
  }

  const token = req.headers["x-gitlab-token"];
  if (token !== project.webhook_secret) {
    res.status(401).send("Unauthorized");
    return;
  }

  const body = req.body;
  const eventType = body.object_kind;

  log.info(`Webhook received: project=${gitlabProjectId}, event=${eventType}`);

  try {
    if (eventType === "merge_request") {
      await handleMergeRequestEvent(body, project);
    }
  } catch (err: any) {
    log.error(`Webhook error`, err);
  }

  res.status(200).send("OK");
});

async function handleMergeRequestEvent(body: any, project: any): Promise<void> {
  const action = body.object_attributes?.action;
  const mrIid = body.object_attributes?.iid;

  if (!mrIid) return;

  log.info(`MR event: project=${project.gitlab_project_id}, MR=${mrIid}, action=${action}`);

  if (action === "open") {
    const baseUrl = getServiceUrl();
    const comment = [
      "🚀 **Review Environment 可用**",
      "",
      `- 开发环境：${baseUrl}/mr/${project.gitlab_project_id}/${mrIid}`,
    ].join("\n");
    await gitlabApi.postComment(project, mrIid, comment);
  } else if (action === "merge" || action === "close") {
    const stopped = await dockerManager.stopContainer(project.id, project.gitlab_project_id, mrIid);
    if (stopped) {
      log.info(`Container for project ${project.gitlab_project_id} MR ${mrIid} cleaned up (${action})`);
    }
  }
}
