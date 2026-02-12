import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { and, eq, gt, isNull, or, desc } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db, schema } from '../db/connection.js';

const AUTH_COOKIE_NAME = 'sf_token';
const AUTH_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  isMember?: boolean;
}

interface JwtPayload {
  userId: string;
  email: string;
  role?: string;
}

function parseCookies(raw: string | undefined): Record<string, string> {
  if (!raw) return {};

  return raw.split(';').reduce<Record<string, string>>((acc, chunk) => {
    const [key, ...valueParts] = chunk.trim().split('=');
    if (!key || valueParts.length === 0) return acc;

    acc[key] = decodeURIComponent(valueParts.join('='));
    return acc;
  }, {});
}

async function checkActiveMembership(userId: string): Promise<boolean> {
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
  return !!membership;
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[AUTH_COOKIE_NAME];

    if (token) {
      const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
      (req as AuthRequest).userId = decoded.userId;

      // Role from JWT (may be stale if admin changed it, but good enough for most checks)
      (req as AuthRequest).userRole = decoded.role ?? 'user';

      // Membership from DB (always fresh)
      (req as AuthRequest).isMember = await checkActiveMembership(decoded.userId);
    }
  } catch {
    // Silently ignore invalid/expired tokens
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: '请先登录' });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = getUserId(req);

    // Check role-based admin auth (logged-in user with admin role)
    if (userId) {
      // Re-check role from DB for admin access (don't rely on JWT for critical auth)
      const [user] = await db
        .select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      if (user?.role === 'admin') {
        next();
        return;
      }
    }

    // Fallback: legacy x-admin-key header auth
    if (env.adminKey) {
      const headerKey = req.header('x-admin-key');
      if (headerKey && headerKey === env.adminKey) {
        next();
        return;
      }
    }

    res.status(403).json({ message: '需要管理员权限' });
  } catch (error) {
    if (error instanceof Error) {
      next(error);
      return;
    }
    next(new Error('Failed to validate admin permission'));
  }
}

export function getUserId(req: Request): string | undefined {
  return (req as AuthRequest).userId;
}

export function getUserRole(req: Request): string {
  return (req as AuthRequest).userRole ?? 'user';
}

export function getIsMember(req: Request): boolean {
  return (req as AuthRequest).isMember ?? false;
}

export function createAuthToken(userId: string, email: string, role?: string): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId, email, role: role ?? 'user' } as JwtPayload, env.jwtSecret, options);
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: AUTH_MAX_AGE_MS,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
