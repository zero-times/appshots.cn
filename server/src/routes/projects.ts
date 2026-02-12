import { Router } from 'express';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { and, desc, eq, or } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';
import { uploadScreenshots } from '../middleware/upload.js';
import { getSessionId } from '../middleware/session.js';
import { getUserId, getIsMember, requireAuth } from '../middleware/auth.js';
import { sanitizeScreenshotBuffer } from '../services/screenshotSanitizer.js';
import type { CreateProjectRequest, UpdateProjectRequest } from '@appshots/shared';

const router: Router = Router();

function projectScope(projectId: string, sessionId: string, userId?: string) {
  const ownerCondition = userId
    ? or(eq(schema.projects.ownerUserId, userId), eq(schema.projects.ownerSessionId, sessionId))
    : eq(schema.projects.ownerSessionId, sessionId);
  return and(eq(schema.projects.id, projectId), ownerCondition);
}

function getRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

// List projects
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = getUserId(req);

    // 项目中心仅展示登录用户名下项目。
    if (!userId) {
      res.json({ projects: [], total: 0 });
      return;
    }

    const rows = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.ownerUserId, userId))
      .orderBy(desc(schema.projects.createdAt));
    const projects = rows.map(deserializeProject);
    res.json({ projects, total: projects.length });
  } catch (err) {
    next(err);
  }
});

// Create project (login required)
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body as CreateProjectRequest;
    if (!body.appName) {
      res.status(400).json({ message: 'appName is required' });
      return;
    }

    const sessionId = getSessionId(req);
    const now = new Date();
    const project = {
      id: nanoid(),
      ownerSessionId: sessionId,
      ownerUserId: getUserId(req) || null,
      appName: body.appName,
      appDescription: body.appDescription || null,
      templateStyle: 'clean',
      status: 'draft',
      screenshotPaths: null,
      aiAnalysis: null,
      generatedCopy: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.projects).values(project);
    res.status(201).json(deserializeProject(project));
  } catch (err) {
    next(err);
  }
});

// Get project by ID
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const projectId = getRouteParam(req.params.id);
    const [row] = await db.select().from(schema.projects).where(projectScope(projectId, sessionId, getUserId(req)));
    if (!row) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    res.json(deserializeProject(row));
  } catch (err) {
    next(err);
  }
});

// Update project
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const projectId = getRouteParam(req.params.id);
    const scope = projectScope(projectId, sessionId, getUserId(req));
    const [existing] = await db.select({ id: schema.projects.id }).from(schema.projects).where(scope);

    if (!existing) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const body = req.body as UpdateProjectRequest;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const isMember = getIsMember(req);

    if (!isMember && (body.templateStyle !== undefined || body.generatedCopy !== undefined)) {
      res.status(403).json({ message: '编辑模板和文案仅限会员使用' });
      return;
    }

    if (body.appName !== undefined) updates.appName = body.appName;
    if (body.appDescription !== undefined) updates.appDescription = body.appDescription;
    if (body.templateStyle !== undefined) updates.templateStyle = body.templateStyle;
    if (body.generatedCopy !== undefined) updates.generatedCopy = JSON.stringify(body.generatedCopy);

    await db.update(schema.projects).set(updates).where(scope);

    const [row] = await db.select().from(schema.projects).where(scope);
    if (!row) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    res.json(deserializeProject(row));
  } catch (err) {
    next(err);
  }
});

// Delete project
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const projectId = getRouteParam(req.params.id);
    const scope = projectScope(projectId, sessionId, getUserId(req));
    const [existing] = await db.select({ id: schema.projects.id }).from(schema.projects).where(scope);

    if (!existing) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    await db.delete(schema.projects).where(scope);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// Upload screenshots (login required)
router.post('/:id/upload', requireAuth, (req, res, next) => {
  uploadScreenshots(req, res, async (err) => {
    if (err) return next(err);

    try {
      const sessionId = getSessionId(req);
      const projectId = getRouteParam(req.params.id);
      const scope = projectScope(projectId, sessionId, getUserId(req));
      const [existing] = await db.select({ id: schema.projects.id }).from(schema.projects).where(scope);

      if (!existing) {
        res.status(404).json({ message: 'Project not found' });
        return;
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length < 3) {
        res.status(400).json({ message: 'Upload 3-5 screenshots' });
        return;
      }

      await Promise.all(
        files.map(async (file) => {
          const original = await fs.promises.readFile(file.path);
          const sanitized = await sanitizeScreenshotBuffer(original);
          await fs.promises.writeFile(file.path, sanitized);
        }),
      );

      const paths = files.map((file) => file.filename);
      await db
        .update(schema.projects)
        .set({
          screenshotPaths: JSON.stringify(paths),
          updatedAt: new Date(),
        })
        .where(scope);

      const [row] = await db.select().from(schema.projects).where(scope);
      if (!row) {
        res.status(404).json({ message: 'Project not found' });
        return;
      }

      res.json(deserializeProject(row));
    } catch (error) {
      next(error);
    }
  });
});

function deserializeProject(row: Record<string, unknown>) {
  const { ownerSessionId: _ownerSessionId, ownerUserId: _ownerUserId, ...safeRow } = row;

  return {
    ...safeRow,
    screenshotPaths: safeRow.screenshotPaths ? JSON.parse(safeRow.screenshotPaths as string) : [],
    aiAnalysis: safeRow.aiAnalysis ? JSON.parse(safeRow.aiAnalysis as string) : null,
    generatedCopy: safeRow.generatedCopy ? JSON.parse(safeRow.generatedCopy as string) : null,
    createdAt: safeRow.createdAt instanceof Date ? safeRow.createdAt.toISOString() : safeRow.createdAt,
    updatedAt: safeRow.updatedAt instanceof Date ? safeRow.updatedAt.toISOString() : safeRow.updatedAt,
  };
}

export { router as projectRoutes };
