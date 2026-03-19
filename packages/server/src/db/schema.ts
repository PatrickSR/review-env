import type Database from "better-sqlite3";

export function createTables(db: Database.Database): void {
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
  `);
}
