import { createLogger } from "../utils/logger.js";

const log = createLogger("gitlab-api");

export interface GitlabProjectConfig {
  gitlab_url: string;
  gitlab_pat: string;
  gitlab_project_id: number;
  project_path: string;
}

export const gitlabApi = {
  async postComment(project: GitlabProjectConfig, mrIid: number, body: string): Promise<void> {
    const url = `${project.gitlab_url}/api/v4/projects/${project.gitlab_project_id}/merge_requests/${mrIid}/notes`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "PRIVATE-TOKEN": project.gitlab_pat,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      log.error(`Failed to post comment: ${res.status} ${await res.text()}`);
    }
  },

  async getMrInfo(
    project: GitlabProjectConfig,
    mrIid: number
  ): Promise<{ source_branch: string; state: string; title: string }> {
    const url = `${project.gitlab_url}/api/v4/projects/${project.gitlab_project_id}/merge_requests/${mrIid}`;
    const res = await fetch(url, {
      headers: { "PRIVATE-TOKEN": project.gitlab_pat },
    });
    if (!res.ok) {
      throw new Error(`Failed to get MR info: ${res.status}`);
    }
    return res.json() as Promise<{ source_branch: string; state: string; title: string }>;
  },

  /** 通过 GitLab API 获取项目信息，返回 path_with_namespace */
  async getProjectInfo(
    gitlabUrl: string,
    pat: string,
    projectId: number
  ): Promise<{ path_with_namespace: string }> {
    const url = `${gitlabUrl}/api/v4/projects/${projectId}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "PRIVATE-TOKEN": pat },
      });
    } catch (err) {
      log.error(`Failed to connect to GitLab: ${err}`);
      throw new Error("无法连接 GitLab 服务");
    }

    if (res.status === 404) {
      throw new Error("GitLab 项目不存在");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("无法访问 GitLab 项目，请检查 PAT 权限和项目 ID");
    }
    if (!res.ok) {
      log.error(`GitLab API error: ${res.status} ${await res.text()}`);
      throw new Error("无法访问 GitLab 项目，请检查 PAT 权限和项目 ID");
    }

    const data = (await res.json()) as { path_with_namespace: string };
    return { path_with_namespace: data.path_with_namespace };
  },
};
