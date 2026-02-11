import { Router, type NextFunction, type Request, type Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';
import { env } from '../config/env.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../../uploads');

const router: Router = Router();

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  if (!env.adminKey) {
    res.status(503).json({ message: 'Admin API is disabled. Set ADMIN_KEY first.' });
    return;
  }

  const token = req.header('x-admin-key');
  if (!token || token !== env.adminKey) {
    res.status(401).json({ message: 'Invalid admin key' });
    return;
  }

  next();
}

function parseStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  }
  return null;
}

function safeDeleteFile(filename: string): void {
  const normalized = path.basename(filename);
  const target = path.join(uploadsDir, normalized);
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}

function deleteProjectAssets(project: typeof schema.projects.$inferSelect): void {
  const screenshots = parseStringArray(project.screenshotPaths);
  screenshots.forEach((filename) => safeDeleteFile(filename));
}

router.use(requireAdminKey);

router.get('/users', async (_req, res, next) => {
  try {
    const users = await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));

    const usersWithProjects = await Promise.all(
      users.map(async (user) => {
        const projects = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.ownerUserId, user.id))
          .orderBy(desc(schema.projects.updatedAt));

        return {
          id: user.id,
          email: user.email,
          createdAt: toIso(user.createdAt),
          updatedAt: toIso(user.updatedAt),
          projectCount: projects.length,
          projects: projects.map((project) => ({
            id: project.id,
            appName: project.appName,
            status: project.status,
            templateStyle: project.templateStyle,
            screenshotCount: parseStringArray(project.screenshotPaths).length,
            createdAt: toIso(project.createdAt),
            updatedAt: toIso(project.updatedAt),
          })),
        };
      }),
    );

    res.json({ users: usersWithProjects, total: usersWithProjects.length });
  } catch (error) {
    next(error);
  }
});

router.delete('/projects/:projectId', async (req, res, next) => {
  try {
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, req.params.projectId));
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    deleteProjectAssets(project);
    await db.delete(schema.projects).where(eq(schema.projects.id, req.params.projectId));

    res.json({ message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:userId', async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const projects = await db.select().from(schema.projects).where(eq(schema.projects.ownerUserId, userId));
    projects.forEach((project) => deleteProjectAssets(project));

    await db.delete(schema.projects).where(eq(schema.projects.ownerUserId, userId));
    await db.delete(schema.verificationCodes).where(eq(schema.verificationCodes.email, user.email));
    await db.delete(schema.users).where(eq(schema.users.id, userId));

    res.json({ message: 'User deleted', deletedProjectCount: projects.length });
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };
