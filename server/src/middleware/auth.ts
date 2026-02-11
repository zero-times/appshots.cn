import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

const AUTH_COOKIE_NAME = 'sf_token';
const AUTH_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

interface AuthRequest extends Request {
  userId?: string;
}

interface JwtPayload {
  userId: string;
  email: string;
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

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[AUTH_COOKIE_NAME];

    if (token) {
      const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
      (req as AuthRequest).userId = decoded.userId;
    }
  } catch {
    // Silently ignore invalid/expired tokens
  }

  next();
}

export function getUserId(req: Request): string | undefined {
  return (req as AuthRequest).userId;
}

export function createAuthToken(userId: string, email: string): string {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign({ userId, email } as JwtPayload, env.jwtSecret, options);
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
