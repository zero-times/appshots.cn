import { Router } from 'express';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { eq, and, isNull, gt, or, desc } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';
import { getSessionId } from '../middleware/session.js';
import { getUserId, setAuthCookie, clearAuthCookie, createAuthToken, getIsMember } from '../middleware/auth.js';
import { sendVerificationCode } from '../services/mail.js';
import type { SendCodeRequest, VerifyCodeRequest, SendCodeResponse, AuthResponse, MeResponse, MembershipInfo, UsageResponse } from '@appshots/shared';

const router: Router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// POST /send-code
router.post('/send-code', async (req, res, next) => {
  try {
    const { email } = req.body as SendCodeRequest;

    if (!email || !EMAIL_REGEX.test(email)) {
      res.status(400).json({ message: '请输入有效的邮箱地址' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: check for recent unexpired code for this email (1 per minute)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const [recentCode] = await db
      .select()
      .from(schema.verificationCodes)
      .where(
        and(
          eq(schema.verificationCodes.email, normalizedEmail),
          isNull(schema.verificationCodes.usedAt),
          gt(schema.verificationCodes.createdAt, oneMinuteAgo)
        )
      )
      .orderBy(desc(schema.verificationCodes.createdAt))
      .limit(1);

    if (recentCode) {
      res.status(429).json({ message: '请稍后再试，每分钟只能发送一次验证码' });
      return;
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(schema.verificationCodes).values({
      id: nanoid(),
      email: normalizedEmail,
      code,
      expiresAt,
      attempts: 0,
      createdAt: now,
    });

    // Send email (or log in dev mode)
    const mailSent = await sendVerificationCode(normalizedEmail, code);

    if (!mailSent && process.env.NODE_ENV === 'production') {
      res.status(500).json({ message: '邮件发送失败，请稍后再试' });
      return;
    }

    console.log(`[Auth] Verification code for ${normalizedEmail}: ${code}${mailSent ? ' (email sent)' : ' (no SMTP, dev only)'}`);

    const response: SendCodeResponse = {
      message: mailSent ? '验证码已发送到你的邮箱' : '验证码已生成',
      ...(process.env.NODE_ENV !== 'production' && { devCode: code }),
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /verify-code
router.post('/verify-code', async (req, res, next) => {
  try {
    const { email, code } = req.body as VerifyCodeRequest;

    if (!email || !code) {
      res.status(400).json({ message: '邮箱和验证码不能为空' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const now = new Date();

    // Find latest unexpired, unused code for email
    const [latestCode] = await db
      .select()
      .from(schema.verificationCodes)
      .where(
        and(
          eq(schema.verificationCodes.email, normalizedEmail),
          isNull(schema.verificationCodes.usedAt),
          gt(schema.verificationCodes.expiresAt, now)
        )
      )
      .orderBy(desc(schema.verificationCodes.createdAt))
      .limit(1);

    if (!latestCode) {
      res.status(400).json({ message: '验证码无效或已过期' });
      return;
    }

    // Check attempts < 5
    if (latestCode.attempts >= 5) {
      res.status(400).json({ message: '验证码尝试次数过多，请重新获取' });
      return;
    }

    // Increment attempts
    await db
      .update(schema.verificationCodes)
      .set({ attempts: latestCode.attempts + 1 })
      .where(eq(schema.verificationCodes.id, latestCode.id));

    // Check code
    if (latestCode.code !== code) {
      res.status(400).json({ message: '验证码错误' });
      return;
    }

    // Mark as used
    await db
      .update(schema.verificationCodes)
      .set({ usedAt: now })
      .where(eq(schema.verificationCodes.id, latestCode.id));

    // Find or create user
    let isNewUser = false;
    let [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      isNewUser = true;
      const newUser = {
        id: nanoid(),
        email: normalizedEmail,
        role: 'user' as const,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(schema.users).values(newUser);
      [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, newUser.id))
        .limit(1);
    }

    // Migrate anonymous projects from current session
    const sessionId = getSessionId(req);
    const migrationResult = await db
      .update(schema.projects)
      .set({ ownerUserId: user.id, updatedAt: now })
      .where(
        and(
          eq(schema.projects.ownerSessionId, sessionId),
          isNull(schema.projects.ownerUserId)
        )
      );

    const migratedProjectCount = migrationResult.changes;

    // Create JWT with role and set cookie
    const token = createAuthToken(user.id, user.email, user.role ?? 'user');
    setAuthCookie(res, token);

    const membership = await getActiveMembershipInfo(user.id);

    const response: AuthResponse = {
      user: {
        id: user.id,
        email: user.email,
        role: (user.role as 'user' | 'admin') ?? 'user',
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
        updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt),
      },
      isNewUser,
      migratedProjectCount,
      membership,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /me
router.get('/me', async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      const response: MeResponse = { user: null, membership: null };
      res.json(response);
      return;
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      const response: MeResponse = { user: null, membership: null };
      res.json(response);
      return;
    }

    const membership = await getActiveMembershipInfo(user.id);

    const response: MeResponse = {
      user: {
        id: user.id,
        email: user.email,
        role: (user.role as 'user' | 'admin') ?? 'user',
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
        updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : String(user.updatedAt),
      },
      membership,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// GET /usage - Get current user's analysis usage for today
router.get('/usage', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isMember = getIsMember(req);

    if (!userId) {
      const response: UsageResponse = { analysisUsedToday: 0, dailyLimit: 1, isMember: false };
      res.json(response);
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const usageRows = await db
      .select()
      .from(schema.analysisUsage)
      .where(
        and(
          eq(schema.analysisUsage.userId, userId),
          gt(schema.analysisUsage.usedAt, startOfDay),
        ),
      );

    const response: UsageResponse = {
      analysisUsedToday: usageRows.length,
      dailyLimit: isMember ? -1 : 1, // -1 = unlimited
      isMember,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /logout
router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: '已退出登录' });
});

export { router as authRoutes };
