import { config } from "../config.js";

const baseUrl = `${config.gitlabUrl}/api/v4`;
const headers = { "PRIVATE-TOKEN": config.gitlabPat, "Content-Type": "application/json" };

export const gitlabApi = {
  async postComment(projectId: string | number, mrIid: number, body: string): Promise<void> {
    const url = `${baseUrl}/projects/${projectId}/merge_requests/${mrIid}/notes`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      console.error(`Failed to post comment: ${res.status} ${await res.text()}`);
    }
  },

  async getMrInfo(mrIid: number): Promise<{ source_branch: string; state: string; title: string }> {
    const url = `${baseUrl}/projects/${config.gitlabProjectId}/merge_requests/${mrIid}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Failed to get MR info: ${res.status}`);
    }
    return res.json();
  },
};
