import type Database from "better-sqlite3";

export function createTables(db: Database.Database): void {
  db.exec(`
    -- Migration: add ports column to project_images if not exists
    CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);
  `);

  const hasMigration = db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get("add_project_images_ports");
  if (!hasMigration) {
    try {
      db.exec(`ALTER TABLE project_images ADD COLUMN ports TEXT NOT NULL DEFAULT ''`);
    } catch {
      // Column may already exist from fresh CREATE TABLE
    }
    db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES (?)").run("add_project_images_ports");
  }

  const hasBeforeScriptMigration = db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get("add_project_images_before_script");
  if (!hasBeforeScriptMigration) {
    try {
      db.exec(`ALTER TABLE project_images ADD COLUMN before_script TEXT NOT NULL DEFAULT ''`);
    } catch {
      // Column may already exist from fresh CREATE TABLE
    }
    db.prepare("INSERT OR IGNORE INTO _migrations (name) VALUES (?)").run("add_project_images_before_script");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      gitlab_url      TEXT NOT NULL,
      gitlab_project_id INTEGER NOT NULL UNIQUE,
      project_path    TEXT NOT NULL,
      gitlab_pat      TEXT NOT NULL,
      webhook_secret  TEXT NOT NULL,
      git_user_name   TEXT NOT NULL DEFAULT 'review-bot',
      git_user_email  TEXT NOT NULL DEFAULT 'review-bot@company.com',
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS project_images (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      display_name    TEXT NOT NULL,
      image           TEXT NOT NULL,
      env_vars        TEXT NOT NULL DEFAULT '{}',
      sort_order      INTEGER NOT NULL DEFAULT 0,
      enabled         INTEGER NOT NULL DEFAULT 1,
      ports           TEXT NOT NULL DEFAULT '',
      before_script   TEXT NOT NULL DEFAULT '',
      UNIQUE(project_id, name)
    );

    CREATE TABLE IF NOT EXISTS containers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      mr_iid          INTEGER NOT NULL,
      branch          TEXT NOT NULL,
      image_id        INTEGER NOT NULL REFERENCES project_images(id),
      container_id    TEXT NOT NULL,
      ports           TEXT NOT NULL DEFAULT '{}',
      created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, mr_iid)
    );

    CREATE TABLE IF NOT EXISTS test_containers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id    TEXT NOT NULL,
      container_name  TEXT NOT NULL,
      image           TEXT NOT NULL,
      host_port       INTEGER NOT NULL,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
      last_accessed_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}
