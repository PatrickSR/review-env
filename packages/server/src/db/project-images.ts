import { getDb } from "./index.js";

export interface ProjectImage {
  id: number;
  project_id: number;
  name: string;
  display_name: string;
  image: string;
  env_vars: string; // JSON string
  sort_order: number;
  enabled: number; // 0 or 1
}

export interface CreateImageInput {
  project_id: number;
  name: string;
  display_name: string;
  image: string;
  env_vars?: string;
  sort_order?: number;
  enabled?: number;
}

export type UpdateImageInput = Partial<Omit<ProjectImage, "id" | "project_id">>;

export const projectImagesDb = {
  getByProjectId(projectId: number, enabledOnly = false): ProjectImage[] {
    const where = enabledOnly
      ? "WHERE project_id = ? AND enabled = 1"
      : "WHERE project_id = ?";
    return getDb()
      .prepare(`SELECT * FROM project_images ${where} ORDER BY sort_order, id`)
      .all(projectId) as ProjectImage[];
  },

  getById(id: number): ProjectImage | undefined {
    return getDb()
      .prepare("SELECT * FROM project_images WHERE id = ?")
      .get(id) as ProjectImage | undefined;
  },

  create(input: CreateImageInput): ProjectImage {
    const stmt = getDb().prepare(`
      INSERT INTO project_images (project_id, name, display_name, image, env_vars, sort_order, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.project_id,
      input.name,
      input.display_name,
      input.image,
      input.env_vars ?? "{}",
      input.sort_order ?? 0,
      input.enabled ?? 1
    );
    return this.getById(Number(result.lastInsertRowid))!;
  },

  update(id: number, input: UpdateImageInput): ProjectImage | undefined {
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
    getDb().prepare(`UPDATE project_images SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    return this.getById(id);
  },

  delete(id: number): boolean {
    const result = getDb().prepare("DELETE FROM project_images WHERE id = ?").run(id);
    return result.changes > 0;
  },
};
