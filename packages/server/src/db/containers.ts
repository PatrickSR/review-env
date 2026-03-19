import { getDb } from "./index.js";

export interface ContainerRecord {
  id: number;
  project_id: number;
  mr_iid: number;
  branch: string;
  image_id: number;
  container_id: string;
  ports: string; // JSON string
  created_at: number;
}

export interface CreateContainerInput {
  project_id: number;
  mr_iid: number;
  branch: string;
  image_id: number;
  container_id: string;
  ports?: string;
}

export const containersDb = {
  getByProjectAndMr(projectId: number, mrIid: number): ContainerRecord | undefined {
    return getDb()
      .prepare("SELECT * FROM containers WHERE project_id = ? AND mr_iid = ?")
      .get(projectId, mrIid) as ContainerRecord | undefined;
  },

  getById(id: number): ContainerRecord | undefined {
    return getDb()
      .prepare("SELECT * FROM containers WHERE id = ?")
      .get(id) as ContainerRecord | undefined;
  },

  getAll(): ContainerRecord[] {
    return getDb().prepare("SELECT * FROM containers ORDER BY created_at DESC").all() as ContainerRecord[];
  },

  getExpired(timeoutSeconds: number): ContainerRecord[] {
    const cutoff = Math.floor(Date.now() / 1000) - timeoutSeconds;
    return getDb()
      .prepare("SELECT * FROM containers WHERE created_at < ?")
      .all(cutoff) as ContainerRecord[];
  },

  create(input: CreateContainerInput): ContainerRecord {
    const stmt = getDb().prepare(`
      INSERT INTO containers (project_id, mr_iid, branch, image_id, container_id, ports)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      input.project_id,
      input.mr_iid,
      input.branch,
      input.image_id,
      input.container_id,
      input.ports ?? "{}"
    );
    return this.getById(Number(result.lastInsertRowid))!;
  },

  updatePorts(id: number, ports: string): void {
    getDb().prepare("UPDATE containers SET ports = ? WHERE id = ?").run(ports, id);
  },

  delete(id: number): boolean {
    const result = getDb().prepare("DELETE FROM containers WHERE id = ?").run(id);
    return result.changes > 0;
  },

  deleteByProjectAndMr(projectId: number, mrIid: number): boolean {
    const result = getDb()
      .prepare("DELETE FROM containers WHERE project_id = ? AND mr_iid = ?")
      .run(projectId, mrIid);
    return result.changes > 0;
  },

  deleteByContainerId(containerId: string): boolean {
    const result = getDb()
      .prepare("DELETE FROM containers WHERE container_id = ?")
      .run(containerId);
    return result.changes > 0;
  },

  countActive(): number {
    const row = getDb().prepare("SELECT COUNT(*) as count FROM containers").get() as { count: number };
    return row.count;
  },
};
