import { Router } from 'express';
import { nanoid } from 'nanoid';
import { and, eq, gt, or } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';
import { analyzeScreenshots, generateCopy } from '../services/claude.js';
import { getSessionId } from '../middleware/session.js';
import { getUserId, requireAuth, getIsMember } from '../middleware/auth.js';
import { DEFAULT_EXPORT_LANGUAGES, dedupeLanguageCodes } from '@appshots/shared';
import type { AnalyzeProjectRequest } from '@appshots/shared';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../../uploads');

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

// Trigger AI analysis (login required)
router.post('/:id/analyze', requireAuth, async (req, res, next) => {
  const sessionId = getSessionId(req);
  const userId = getUserId(req)!;
  const isMember = getIsMember(req);
  const projectId = getRouteParam(req.params.id);

  try {
    // Rate limit: free users get 1 analysis per day
    if (!isMember) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const [todayUsage] = await db
        .select()
        .from(schema.analysisUsage)
        .where(
          and(
            eq(schema.analysisUsage.userId, userId),
            gt(schema.analysisUsage.usedAt, startOfDay),
          ),
        )
        .limit(1);

      if (todayUsage) {
        const nextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        res.status(429).json({
          message: '免费用户每天只能使用 1 次 AI 分析，升级会员可解锁无限次数',
          nextAvailableAt: nextDay.toISOString(),
        });
        return;
      }
    }

    // Determine languages based on membership
    let requestedLanguages: string[];
    if (!isMember) {
      requestedLanguages = ['zh', 'en']; // free users: basic zh/en only
    } else {
      const body = (req.body ?? {}) as AnalyzeProjectRequest;
      requestedLanguages = dedupeLanguageCodes(body.languages, DEFAULT_EXPORT_LANGUAGES);
    }

    const scope = projectScope(projectId, sessionId, userId);
    const [project] = await db.select().from(schema.projects).where(scope);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    if (project.status === 'completed') {
      res.status(403).json({ message: '项目已导出封存，不能重新分析' });
      return;
    }

    const screenshotPaths: string[] = project.screenshotPaths ? JSON.parse(project.screenshotPaths) : [];
    if (screenshotPaths.length < 3) {
      res.status(400).json({ message: 'Upload at least 3 screenshots first' });
      return;
    }

    // Mark as analyzing
    await db.update(schema.projects).set({ status: 'analyzing', updatedAt: new Date() }).where(scope);

    // Read screenshot buffers
    const buffers = screenshotPaths.map((filePath: string) => fs.readFileSync(path.join(uploadsDir, filePath)));

    // Step 1: Vision analysis
    const analysis = await analyzeScreenshots(buffers, project.appName, project.appDescription || undefined);

    // Step 2: Copy generation
    const copy = await generateCopy(
      analysis,
      project.appName,
      screenshotPaths.length,
      project.appDescription || undefined,
      requestedLanguages,
    );

    // Save results
    await db
      .update(schema.projects)
      .set({
        aiAnalysis: JSON.stringify(analysis),
        generatedCopy: JSON.stringify(copy),
        templateStyle: analysis.recommendedTemplate,
        status: 'ready',
        updatedAt: new Date(),
      })
      .where(scope);

    // Record usage for free users (persistent rate limiting)
    if (!isMember) {
      await db.insert(schema.analysisUsage).values({
        id: nanoid(),
        userId,
        usedAt: new Date(),
        projectId,
      });
    }

    res.json({
      analysis,
      generatedCopy: copy,
      languages: requestedLanguages,
      recommendedTemplate: analysis.recommendedTemplate,
      recommendedCompositionMode: analysis.recommendedCompositionMode,
      recommendedTemplateCombo: analysis.recommendedTemplateCombo,
      isMember,
    });
  } catch (err) {
    // Reset status on error
    await db
      .update(schema.projects)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(projectScope(projectId, sessionId, userId));
    next(err);
  }
});

export { router as analyzeRoutes };
