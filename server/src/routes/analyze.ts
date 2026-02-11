import { Router } from 'express';
import { and, eq, or } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';
import { analyzeScreenshots, generateCopy } from '../services/claude.js';
import { getSessionId } from '../middleware/session.js';
import { getUserId } from '../middleware/auth.js';
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

// Trigger AI analysis
router.post('/:id/analyze', async (req, res, next) => {
  const sessionId = getSessionId(req);
  const userId = getUserId(req);

  try {
    const scope = projectScope(req.params.id, sessionId, userId);
    const [project] = await db.select().from(schema.projects).where(scope);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
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
    const copy = await generateCopy(analysis, project.appName, screenshotPaths.length, project.appDescription || undefined);

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

    res.json({
      analysis,
      generatedCopy: copy,
      recommendedTemplate: analysis.recommendedTemplate,
      recommendedCompositionMode: analysis.recommendedCompositionMode,
      recommendedTemplateCombo: analysis.recommendedTemplateCombo,
    });
  } catch (err) {
    // Reset status on error
    await db
      .update(schema.projects)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(projectScope(req.params.id, sessionId, userId));
    next(err);
  }
});

export { router as analyzeRoutes };
