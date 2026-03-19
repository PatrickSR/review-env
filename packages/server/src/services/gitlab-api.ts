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
};
