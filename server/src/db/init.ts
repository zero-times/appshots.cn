import { db } from './connection.js';
import { sql } from 'drizzle-orm';

export function initDatabase() {
  db.run(sql`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_session_id TEXT NOT NULL,
    app_name TEXT NOT NULL,
    app_description TEXT,
    template_style TEXT NOT NULL DEFAULT 'clean',
    status TEXT NOT NULL DEFAULT 'draft',
    screenshot_paths TEXT,
    ai_analysis TEXT,
    generated_copy TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  const columns = db.all<{ name: string }>(sql`PRAGMA table_info(projects)`);
  const hasOwnerSessionId = columns.some((column) => column.name === 'owner_session_id');

  if (!hasOwnerSessionId) {
    db.run(sql`ALTER TABLE projects ADD COLUMN owner_session_id TEXT NOT NULL DEFAULT ''`);
  }

  const hasOwnerUserId = columns.some((column) => column.name === 'owner_user_id');
  if (!hasOwnerUserId) {
    db.run(sql`ALTER TABLE projects ADD COLUMN owner_user_id TEXT`);
  }

  // Auth tables
  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);

  console.log('[DB] Database initialized');
}
