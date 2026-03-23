import { Router } from "express";
import { projectsDb } from "../db/projects.js";
import { projectImagesDb } from "../db/project-images.js";
import { containersDb } from "../db/containers.js";
import { testContainersDb } from "../db/test-containers.js";
import { dockerManager } from "../services/docker-manager.js";
import { gitlabApi } from "../services/gitlab-api.js";
import { config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("api");

/** 校验端口字符串，返回无效项列表；空字符串视为合法 */
function validatePorts(ports: string): string[] {
  if (!ports || !ports.trim()) return [];
  const invalid: string[] = [];
  for (const raw of ports.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const num = Number(trimmed);
    if (!Number.isInteger(num) || num < 1 || num > 65535) {
      invalid.push(trimmed);
    }
  }
  return invalid;
}

export const apiRouter = Router();

// --- Projects CRUD ---

apiRouter.get("/projects", (_req, res) => {
  const projects = projectsDb.getAll().map((p) => ({
    ...p,
    gitlab_pat: "***", // mask PAT
  }));
  res.json(projects);
});

apiRouter.post("/projects", async (req, res) => {
  const { name, gitlab_project_id, gitlab_pat, webhook_secret, git_user_name, git_user_email } = req.body;
  if (!name || !gitlab_project_id || !gitlab_pat || !webhook_secret) {
    res.status(400).json({ error: "缺少必填字段：名称、GitLab 项目 ID、GitLab PAT、Webhook Secret" });
    return;
  }

  const existing = projectsDb.getByGitlabProjectId(gitlab_project_id);
  if (existing) {
    res.status(409).json({ error: "该 GitLab 项目 ID 已存在" });
    return;
  }

  // 通过 GitLab API 自动获取 project_path
  let projectPath: string;
  try {
    const info = await gitlabApi.getProjectInfo(config.gitlabUrl, gitlab_pat, gitlab_project_id);
    projectPath = info.path_with_namespace;
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  try {
    const project = projectsDb.create({
      name,
      gitlab_url: config.gitlabUrl,
      gitlab_project_id,
      project_path: projectPath,
      gitlab_pat,
      webhook_secret,
      git_user_name: git_user_name || "review-bot",
      git_user_email: git_user_email || "review-bot@company.com",
    });
    log.info(`Project created: ${name} (gitlab_project_id=${gitlab_project_id})`);
    res.status(201).json(project);
  } catch (err: any) {
    log.error("Failed to create project", err);
    res.status(500).json({ error: "创建项目失败" });
  }
});

apiRouter.get("/projects/:id", (req, res) => {
  const project = projectsDb.getById(Number(req.params.id));
  if (!project) {
    res.status(404).json({ error: "未找到项目" });
    return;
  }
  res.json({ ...project, gitlab_pat: "***" });
});

apiRouter.put("/projects/:id", (req, res) => {
  const id = Number(req.params.id);
  const project = projectsDb.getById(id);
  if (!project) {
    res.status(404).json({ error: "未找到项目" });
    return;
  }

  try {
    const updated = projectsDb.update(id, req.body);
    log.info(`Project updated: id=${id}`);
    res.json(updated);
  } catch (err: any) {
    log.error("Failed to update project", err);
    res.status(500).json({ error: "更新项目失败" });
  }
});

apiRouter.delete("/projects/:id", async (req, res) => {
  const id = Number(req.params.id);
  const project = projectsDb.getById(id);
  if (!project) {
    res.status(404).json({ error: "未找到项目" });
    return;
  }

  // Stop all containers for this project
  const containers = containersDb.getAll().filter((c) => c.project_id === id);
  for (const c of containers) {
    await dockerManager.stopContainerById(c.id);
  }

  projectsDb.delete(id);
  log.info(`Project deleted: id=${id}, name=${project.name}`);
  res.json({ success: true });
});

// --- Project Images CRUD ---

apiRouter.get("/projects/:id/images", (req, res) => {
  const id = Number(req.params.id);
  const project = projectsDb.getById(id);
  if (!project) {
    res.status(404).json({ error: "未找到项目" });
    return;
  }
  const images = projectImagesDb.getByProjectId(id);
  res.json(images);
});

apiRouter.post("/projects/:id/images", (req, res) => {
  const id = Number(req.params.id);
  const project = projectsDb.getById(id);
  if (!project) {
    res.status(404).json({ error: "未找到项目" });
    return;
  }

  const { name, display_name, image, env_vars, ports, sort_order, enabled } = req.body;
  if (!name || !display_name || !image) {
    res.status(400).json({ error: "缺少必填字段：标识名、显示名、Docker 镜像" });
    return;
  }

  if (ports) {
    const invalid = validatePorts(ports);
    if (invalid.length > 0) {
      res.status(400).json({ error: `端口格式无效：${invalid.join(", ")}（请输入 1-65535 的数字，逗号分隔）` });
      return;
    }
  }

  try {
    const img = projectImagesDb.create({
      project_id: id,
      name,
      display_name,
      image,
      env_vars: typeof env_vars === "string" ? env_vars : JSON.stringify(env_vars || {}),
      ports: ports ?? "",
      sort_order: sort_order ?? 0,
      enabled: enabled ?? 1,
    });
    log.info(`Image created: ${display_name} for project id=${id}`);
    res.status(201).json(img);
  } catch (err: any) {
    if (err.message?.includes("UNIQUE")) {
      res.status(409).json({ error: "该项目下已存在同名镜像标识" });
      return;
    }
    log.error("Failed to create image", err);
    res.status(500).json({ error: "创建镜像失败" });
  }
});

apiRouter.put("/projects/:id/images/:imageId", (req, res) => {
  const imageId = Number(req.params.imageId);
  const img = projectImagesDb.getById(imageId);
  if (!img || img.project_id !== Number(req.params.id)) {
    res.status(404).json({ error: "未找到镜像" });
    return;
  }

  try {
    const body = { ...req.body };
    if (body.env_vars && typeof body.env_vars !== "string") {
      body.env_vars = JSON.stringify(body.env_vars);
    }
    if (body.ports !== undefined) {
      const invalid = validatePorts(body.ports);
      if (invalid.length > 0) {
        res.status(400).json({ error: `端口格式无效：${invalid.join(", ")}（请输入 1-65535 的数字，逗号分隔）` });
        return;
      }
    }
    const updated = projectImagesDb.update(imageId, body);
    log.info(`Image updated: id=${imageId}`);
    res.json(updated);
  } catch (err: any) {
    log.error("Failed to update image", err);
    res.status(500).json({ error: "更新镜像失败" });
  }
});

apiRouter.delete("/projects/:id/images/:imageId", (req, res) => {
  const imageId = Number(req.params.imageId);
  const img = projectImagesDb.getById(imageId);
  if (!img || img.project_id !== Number(req.params.id)) {
    res.status(404).json({ error: "未找到镜像" });
    return;
  }

  projectImagesDb.delete(imageId);
  log.info(`Image deleted: id=${imageId}`);
  res.json({ success: true });
});

// --- Containers ---

apiRouter.get("/containers", (_req, res) => {
  const containers = containersDb.getAll();
  // Enrich with project and image info
  const enriched = containers.map((c) => {
    const project = projectsDb.getById(c.project_id);
    const image = projectImagesDb.getById(c.image_id);
    return {
      ...c,
      type: "review" as const,
      project_name: project?.name,
      gitlab_project_id: project?.gitlab_project_id,
      image_display_name: image?.display_name,
      ports: JSON.parse(c.ports || "{}"),
    };
  });

  // Add test containers
  const testContainers = testContainersDb.getAll().map((tc) => ({
    id: tc.id,
    container_id: tc.container_id,
    type: "test" as const,
    project_name: null,
    gitlab_project_id: null,
    mr_iid: null,
    image_display_name: tc.image,
    created_at: tc.created_at,
    ports: {},
  }));

  res.json([...enriched, ...testContainers]);
});

apiRouter.delete("/containers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const stopped = await dockerManager.stopContainerById(id);
  if (!stopped) {
    res.status(404).json({ error: "未找到容器" });
    return;
  }
  res.json({ success: true });
});

apiRouter.get("/stats", (_req, res) => {
  const activeContainers = containersDb.countActive();
  const projectCount = projectsDb.getAll().length;
  res.json({
    active_containers: activeContainers,
    configured_projects: projectCount,
    max_containers: config.maxContainers,
  });
});
