import { getDb } from "./index.js";

export interface TestContainerRecord {
  id: number;
  container_id: string;
  container_name: string;
  image: string;
  host_port: number;
  created_at: number;
  last_accessed_at: number;
}

export const testContainersDb = {
  getOne(): TestContainerRecord | undefined {
    return getDb()
      .prepare("SELECT * FROM test_containers LIMIT 1")
      .get() as TestContainerRecord | undefined;
  },

  getAll(): TestContainerRecord[] {
    return getDb()
      .prepare("SELECT * FROM test_containers ORDER BY created_at DESC")
      .all() as TestContainerRecord[];
  },

  create(input: {
    container_id: string;
    container_name: string;
    image: string;
    host_port: number;
  }): TestContainerRecord {
    const stmt = getDb().prepare(`
      INSERT INTO test_containers (container_id, container_name, image, host_port)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(input.container_id, input.container_name, input.image, input.host_port);
    return getDb()
      .prepare("SELECT * FROM test_containers WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as TestContainerRecord;
  },

  delete(id: number): boolean {
    const result = getDb().prepare("DELETE FROM test_containers WHERE id = ?").run(id);
    return result.changes > 0;
  },

  deleteByContainerId(containerId: string): boolean {
    const result = getDb()
      .prepare("DELETE FROM test_containers WHERE container_id = ?")
      .run(containerId);
    return result.changes > 0;
  },

  updateLastAccessed(id: number): void {
    const now = Math.floor(Date.now() / 1000);
    getDb().prepare("UPDATE test_containers SET last_accessed_at = ? WHERE id = ?").run(now, id);
  },

  getExpired(timeoutSeconds: number): TestContainerRecord[] {
    const cutoff = Math.floor(Date.now() / 1000) - timeoutSeconds;
    return getDb()
      .prepare("SELECT * FROM test_containers WHERE last_accessed_at < ?")
      .all(cutoff) as TestContainerRecord[];
  },
};
