import { Router } from "express";
import { config } from "../config.js";
import { dockerManager } from "../services/docker-manager.js";
import { gitlabApi } from "../services/gitlab-api.js";

export const webhookRouter = Router();

function getServiceUrl(): string {
  return `http://localhost:${config.port}`;
}

function formatPortsInfo(ports: Record<number, number>): string {
  const entries = Object.entries(ports);
  if (entries.length === 0) return "（端口映射暂不可用）";
  return entries
    .map(([container, host]) => `  - 容器端口 ${container} → 宿主机端口 ${host}`)
    .join("\n");
}

webhookRouter.post("/webhook", async (req, res) => {
  const token = req.headers["x-gitlab-token"];
  if (token !== config.webhookSecret) {
    res.status(401).send("Unauthorized");
    return;
  }

  const body = req.body;
  const eventType = body.object_kind;

  try {
    if (eventType === "merge_request") {
      await handleMergeRequestEvent(body);
    } else if (eventType === "note") {
      await handleNoteEvent(body);
    }
  } catch (err: any) {
    console.error(`Webhook error: ${err.message}`);
  }

  res.status(200).send("OK");
});

async function handleMergeRequestEvent(body: any): Promise<void> {
  const action = body.object_attributes?.action;
  const mrIid = body.object_attributes?.iid;
  const projectId = body.project?.id;

  if (!mrIid || !projectId) return;

  if (action === "open") {
    const baseUrl = getServiceUrl();
    const comment = [
      "🚀 **Review Environment 可用**",
      "",
      `- 终端：${baseUrl}/mr/${mrIid}`,
      "",
      "**可用命令：**",
      "- `/review-start` — 启动 review 环境",
      "- `/review-stop` — 停止 review 环境",
      "- `/review-status` — 查看环境状态和端口映射",
    ].join("\n");
    await gitlabApi.postComment(projectId, mrIid, comment);
  } else if (action === "merge" || action === "close") {
    const stopped = await dockerManager.stopContainer(mrIid);
    if (stopped) {
      console.log(`Container for MR ${mrIid} cleaned up (${action})`);
    }
  }
}

async function handleNoteEvent(body: any): Promise<void> {
  const note = body.object_attributes?.note?.trim();
  const mrIid = body.merge_request?.iid;
  const projectId = body.project?.id;

  if (!note || !mrIid || !projectId) return;
  if (!note.startsWith("/review-")) return;

  const command = note.split(/\s/)[0];

  switch (command) {
    case "/review-start":
      await handleReviewStart(projectId, mrIid, body.merge_request?.source_branch);
      break;
    case "/review-stop":
      await handleReviewStop(projectId, mrIid);
      break;
    case "/review-status":
      await handleReviewStatus(projectId, mrIid);
      break;
    default:
      break;
  }
}

async function handleReviewStart(projectId: number, mrIid: number, branch?: string): Promise<void> {
  const baseUrl = getServiceUrl();

  const existing = dockerManager.getInfo(mrIid);
  if (existing) {
    const comment = [
      "✅ Review 环境已在运行中",
      "",
      `- 终端：${baseUrl}/mr/${mrIid}`,
      "- 端口映射：",
      formatPortsInfo(existing.ports),
    ].join("\n");
    await gitlabApi.postComment(projectId, mrIid, comment);
    return;
  }

  try {
    if (!branch) {
      const mrInfo = await gitlabApi.getMrInfo(mrIid);
      branch = mrInfo.source_branch;
    }

    const info = await dockerManager.createContainer(mrIid, branch);

    const comment = [
      "🚀 Review 环境已启动",
      "",
      `- 终端：${baseUrl}/mr/${mrIid}`,
      "- 端口映射：",
      formatPortsInfo(info.ports),
      `- 超时：${config.containerTimeoutHours} 小时后自动销毁`,
    ].join("\n");
    await gitlabApi.postComment(projectId, mrIid, comment);
  } catch (err: any) {
    await gitlabApi.postComment(projectId, mrIid, `❌ 启动失败：${err.message}`);
  }
}

async function handleReviewStop(projectId: number, mrIid: number): Promise<void> {
  const stopped = await dockerManager.stopContainer(mrIid);
  if (stopped) {
    await gitlabApi.postComment(projectId, mrIid, "🛑 Review 环境已销毁");
  } else {
    await gitlabApi.postComment(projectId, mrIid, "ℹ️ 该 MR 没有运行中的 review 环境");
  }
}

async function handleReviewStatus(projectId: number, mrIid: number): Promise<void> {
  const status = await dockerManager.getContainerStatus(mrIid);
  const baseUrl = getServiceUrl();

  const statusLabels: Record<string, string> = {
    not_found: "未创建",
    creating: "正在创建",
    initializing: "正在初始化",
    ready: "就绪",
    error: "错误",
  };

  const label = statusLabels[status.status] || status.status;
  let comment = `📊 Review 环境状态：**${label}**`;

  if (status.status === "ready") {
    comment += `\n\n- 终端：${baseUrl}/mr/${mrIid}`;
    if (status.ports) {
      comment += "\n- 端口映射：\n" + formatPortsInfo(status.ports);
    }
  }
  if (status.message) {
    comment += `\n\n详情：${status.message}`;
  }

  await gitlabApi.postComment(projectId, mrIid, comment);
}
