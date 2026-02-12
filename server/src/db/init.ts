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
    last_export_zip_url TEXT,
    last_exported_at INTEGER,
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

  const hasLastExportZipUrl = columns.some((column) => column.name === 'last_export_zip_url');
  if (!hasLastExportZipUrl) {
    db.run(sql`ALTER TABLE projects ADD COLUMN last_export_zip_url TEXT`);
  }

  const hasLastExportedAt = columns.some((column) => column.name === 'last_exported_at');
  if (!hasLastExportedAt) {
    db.run(sql`ALTER TABLE projects ADD COLUMN last_exported_at INTEGER`);
  }

  // Auth tables
  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'user',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  // Migrate: add role column to users if missing
  const userColumns = db.all<{ name: string }>(sql`PRAGMA table_info(users)`);
  const hasRole = userColumns.some((column) => column.name === 'role');
  if (!hasRole) {
    db.run(sql`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  }

  db.run(sql`CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);

  // Memberships table
  db.run(sql`CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    activated_at INTEGER NOT NULL,
    expires_at INTEGER,
    activated_by TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  // Analysis usage tracking (persistent daily rate limiting)
  db.run(sql`CREATE TABLE IF NOT EXISTS analysis_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    used_at INTEGER NOT NULL,
    project_id TEXT NOT NULL
  )`);

  console.log('[DB] Database initialized');
}
