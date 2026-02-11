import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'sf_sid';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
const SESSION_ID_PATTERN = /^[a-f0-9]{64}$/;

interface SessionRequest extends Request {
  sessionId?: string;
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

function createSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const existing = cookies[SESSION_COOKIE_NAME];
  const sessionId = existing && SESSION_ID_PATTERN.test(existing) ? existing : createSessionId();

  (req as SessionRequest).sessionId = sessionId;

  if (sessionId !== existing) {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE_MS,
      path: '/',
    });
  }

  next();
}

export function getSessionId(req: Request): string {
  const sessionId = (req as SessionRequest).sessionId;
  if (!sessionId) {
    throw new Error('Session not initialized');
  }
  return sessionId;
}
