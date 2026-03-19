import { getDb } from "./index.js";

export interface Project {
  id: number;
  name: string;
  gitlab_url: string;
  gitlab_project_id: number;
  project_path: string;
  gitlab_pat: string;
  webhook_secret: string;
  git_user_name: string;
  git_user_email: string;
  created_at: number;
}

export type CreateProjectInput = Omit<Project, "id" | "created_at">;
export type UpdateProjectInput = Partial<Omit<Project, "id" | "created_at">>;

export const projectsDb = {
  getAll(): Project[] {
    return getDb().prepare("SELECT * FROM projects ORDER BY id").all() as Project[];
  },

  getById(id: number): Project | undefined {
    return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
  },

  getByGitlabProjectId(gitlabProjectId: number): Project | undefined {
    return getDb()
      .prepare("SELECT * FROM projects WHERE gitlab_project_id = ?")
      .get(gitlabProjectId) as Project | undefined;
  },

  create(input: CreateProjectInput): Project {
    const stmt = getDb().prepare(`
      INSERT INTO projects (name, gitlab_url, gitlab_project_id, project_path, gitlab_pat, webhook_secret, git_user_name, git_user_email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.name,
      input.gitlab_url,
      input.gitlab_project_id,
      input.project_path,
      input.gitlab_pat,
      input.webhook_secret,
      input.git_user_name,
      input.git_user_email
    );
    return this.getById(Number(result.lastInsertRowid))!;
  },

  update(id: number, input: UpdateProjectInput): Project | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) return this.getById(id);
    values.push(id);
    getDb().prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: number): boolean {
    const result = getDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
    return result.changes > 0;
  },
};
