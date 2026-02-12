import { Router } from 'express';
import { nanoid } from 'nanoid';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';
import { requireAdmin, getUserId } from '../middleware/auth.js';
import type { MembershipInfo } from '@appshots/shared';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../../uploads');

const router: Router = Router();

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

async function getActiveMembershipInfo(userId: string): Promise<MembershipInfo | null> {
  const now = new Date();
  const [membership] = await db
    .select()
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.userId, userId),
        eq(schema.memberships.status, 'active'),
        or(
          isNull(schema.memberships.expiresAt),
          gt(schema.memberships.expiresAt, now),
        ),
      ),
    )
    .orderBy(desc(schema.memberships.activatedAt))
    .limit(1);

  if (!membership) return null;

  return {
    status: 'active',
    activatedAt: membership.activatedAt instanceof Date ? membership.activatedAt.toISOString() : String(membership.activatedAt),
    expiresAt: membership.expiresAt instanceof Date ? membership.expiresAt.toISOString() : membership.expiresAt ? String(membership.expiresAt) : null,
  };
}

// All admin routes require admin auth (role-based or legacy admin key)
router.use(requireAdmin);

// List all users with projects and membership info
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

        const membership = await getActiveMembershipInfo(user.id);

        // Count today's analysis usage
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayUsage = await db
          .select()
          .from(schema.analysisUsage)
          .where(
            and(
              eq(schema.analysisUsage.userId, user.id),
              gt(schema.analysisUsage.usedAt, startOfDay),
            ),
          );

        return {
          id: user.id,
          email: user.email,
          role: user.role ?? 'user',
          membership,
          createdAt: toIso(user.createdAt),
          updatedAt: toIso(user.updatedAt),
          projectCount: projects.length,
          analysisCountToday: todayUsage.length,
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

// List active members
router.get('/members', async (_req, res, next) => {
  try {
    const now = new Date();
    const activeMembers = await db
      .select()
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.status, 'active'),
          or(
            isNull(schema.memberships.expiresAt),
            gt(schema.memberships.expiresAt, now),
          ),
        ),
      )
      .orderBy(desc(schema.memberships.activatedAt));

    const membersWithUsers = await Promise.all(
      activeMembers.map(async (m) => {
        const [user] = await db.select().from(schema.users).where(eq(schema.users.id, m.userId));
        return {
          ...m,
          activatedAt: toIso(m.activatedAt),
          expiresAt: m.expiresAt ? toIso(m.expiresAt) : null,
          createdAt: toIso(m.createdAt),
          updatedAt: toIso(m.updatedAt),
          user: user ? { id: user.id, email: user.email, role: user.role ?? 'user' } : null,
        };
      }),
    );

    res.json({ members: membersWithUsers, total: membersWithUsers.length });
  } catch (error) {
    next(error);
  }
});

// Set user role
router.patch('/users/:userId/role', async (req, res, next) => {
  try {
    const { role } = req.body as { role: string };
    const operatorUserId = getUserId(req);
    if (role !== 'user' && role !== 'admin') {
      res.status(400).json({ message: 'Invalid role. Must be "user" or "admin".' });
      return;
    }

    if (operatorUserId && operatorUserId === req.params.userId && role === 'user') {
      res.status(400).json({ message: 'Cannot remove your own admin role' });
      return;
    }

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.params.userId));
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    await db.update(schema.users).set({ role, updatedAt: new Date() }).where(eq(schema.users.id, req.params.userId));
    res.json({ message: 'Role updated', userId: req.params.userId, role });
  } catch (error) {
    next(error);
  }
});

// Activate or revoke membership
router.post('/users/:userId/membership', async (req, res, next) => {
  try {
    const { action, expiresAt, note } = req.body as {
      action: 'activate' | 'revoke';
      expiresAt?: string | null;
      note?: string;
    };
    const adminUserId = getUserId(req);

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, req.params.userId));
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const now = new Date();

    if (action === 'activate') {
      const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;
      if (parsedExpiresAt && Number.isNaN(parsedExpiresAt.getTime())) {
        res.status(400).json({ message: 'Invalid expiresAt value' });
        return;
      }

      // Revoke any existing active membership first
      await db
        .update(schema.memberships)
        .set({ status: 'revoked', updatedAt: now })
        .where(
          and(
            eq(schema.memberships.userId, req.params.userId),
            eq(schema.memberships.status, 'active'),
          ),
        );

      // Create new membership
      const membership = {
        id: nanoid(),
        userId: req.params.userId,
        status: 'active' as const,
        activatedAt: now,
        expiresAt: parsedExpiresAt,
        activatedBy: adminUserId || null,
        note: note || null,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(schema.memberships).values(membership);
      res.json({ message: 'Membership activated', membership: { ...membership, activatedAt: toIso(now), expiresAt: expiresAt || null } });
    } else if (action === 'revoke') {
      await db
        .update(schema.memberships)
        .set({ status: 'revoked', updatedAt: now })
        .where(
          and(
            eq(schema.memberships.userId, req.params.userId),
            eq(schema.memberships.status, 'active'),
          ),
        );
      res.json({ message: 'Membership revoked' });
    } else {
      res.status(400).json({ message: 'Invalid action. Must be "activate" or "revoke".' });
    }
  } catch (error) {
    next(error);
  }
});

// Delete project
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

// Delete user and all their projects
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
    await db.delete(schema.memberships).where(eq(schema.memberships.userId, userId));
    await db.delete(schema.analysisUsage).where(eq(schema.analysisUsage.userId, userId));
    await db.delete(schema.verificationCodes).where(eq(schema.verificationCodes.email, user.email));
    await db.delete(schema.users).where(eq(schema.users.id, userId));

    res.json({ message: 'User deleted', deletedProjectCount: projects.length });
  } catch (error) {
    next(error);
  }
});

export { router as adminRoutes };
