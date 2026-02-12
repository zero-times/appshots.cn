import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  ownerSessionId: text('owner_session_id').notNull().default(''),
  ownerUserId: text('owner_user_id'),
  appName: text('app_name').notNull(),
  appDescription: text('app_description'),
  templateStyle: text('template_style').notNull().default('clean'),
  status: text('status').notNull().default('draft'),
  screenshotPaths: text('screenshot_paths'), // JSON array
  aiAnalysis: text('ai_analysis'),           // JSON
  generatedCopy: text('generated_copy'),     // JSON
  lastExportZipUrl: text('last_export_zip_url'),
  lastExportedAt: integer('last_exported_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verificationCodes = sqliteTable('verification_codes', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  attempts: integer('attempts').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const memberships = sqliteTable('memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'expired' | 'revoked'
  activatedAt: integer('activated_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }), // null = lifetime
  activatedBy: text('activated_by'), // admin userId who activated
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const analysisUsage = sqliteTable('analysis_usage', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }).notNull(),
  projectId: text('project_id').notNull(),
});
