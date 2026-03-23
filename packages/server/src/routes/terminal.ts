import { Router } from "express";
import express from "express";
import { projectsDb } from "../db/projects.js";
import { projectImagesDb } from "../db/project-images.js";
import { containersDb } from "../db/containers.js";
import { dockerManager } from "../services/docker-manager.js";
import { gitlabApi } from "../services/gitlab-api.js";
import { config } from "../config.js";

export const terminalRouter = Router();

// Terminal status API
terminalRouter.get("/mr/:projectId/:mrIid/status", async (req, res) => {
  const gitlabProjectId = Number(req.params.projectId);
  const mrIid = Number(req.params.mrIid);

  const project = projectsDb.getByGitlabProjectId(gitlabProjectId);
  if (!project) {
    res.json({ status: "not_found" });
    return;
  }

  const status = await dockerManager.getContainerStatus(project.id, mrIid);
  res.json(status);
});

// Start container with selected image
terminalRouter.post("/mr/:projectId/:mrIid/start", express.json(), async (req, res) => {
  const gitlabProjectId = Number(req.params.projectId);
  const mrIid = Number(req.params.mrIid);
  const { imageId } = req.body;

  if (!gitlabProjectId || !mrIid || !imageId) {
    res.status(400).json({ error: "Missing required parameters" });
    return;
  }

  const project = projectsDb.getByGitlabProjectId(gitlabProjectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Validate imageId belongs to this project and is enabled
  const image = projectImagesDb.getById(imageId);
  if (!image || image.project_id !== project.id) {
    res.status(400).json({ error: "Image not found or does not belong to this project" });
    return;
  }
  if (!image.enabled) {
    res.status(400).json({ error: "Image is disabled" });
    return;
  }

  try {
    // Get branch from GitLab
    const mrInfo = await gitlabApi.getMrInfo(project, mrIid);

    const record = await dockerManager.createContainer({
      project,
      imageId,
      mrIid,
      branch: mrInfo.source_branch,
    });

    res.json({ success: true, container: record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Stop container
terminalRouter.post("/mr/:projectId/:mrIid/stop", async (req, res) => {
  const gitlabProjectId = Number(req.params.projectId);
  const mrIid = Number(req.params.mrIid);

  const project = projectsDb.getByGitlabProjectId(gitlabProjectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const stopped = await dockerManager.stopContainer(project.id, gitlabProjectId, mrIid);
  if (!stopped) {
    res.status(404).json({ error: "No container found for this MR" });
    return;
  }

  res.json({ success: true });
});

// Get available images for this project
terminalRouter.get("/mr/:projectId/:mrIid/images", (req, res) => {
  const gitlabProjectId = Number(req.params.projectId);

  const project = projectsDb.getByGitlabProjectId(gitlabProjectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const images = projectImagesDb.getByProjectId(project.id, true); // enabled only
  res.json(images);
});
