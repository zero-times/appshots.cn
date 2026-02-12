import { Router } from 'express';
import { and, eq, or } from 'drizzle-orm';
import { db, schema } from '../db/connection.js';
import { composeScreenshot } from '../services/imageComposer.js';
import { generateExportZip } from '../services/exportService.js';
import {
  createExportJob,
  getExportJob,
  subscribeExportJob,
  updateExportJob,
  completeExportJob,
  failExportJob,
} from '../services/exportJobStore.js';
import { TEMPLATES, DEVICE_SIZES, DEFAULT_EXPORT_LANGUAGES, dedupeLanguageCodes, normalizeLanguageCode } from '@appshots/shared';
import type { DeviceSizeId, ExportRequest, GeneratedCopy, TemplateStyleId } from "@appshots/shared";
import { getSessionId } from '../middleware/session.js';
import { getUserId, requireAuth, getIsMember } from '../middleware/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../../uploads');
const exportsDir = path.resolve(__dirname, '../../../uploads/exports');
const ADVANCED_EXPORT_COOLDOWN_MS = 5 * 60 * 1000;

const advancedExportLastRequestAt = new Map<string, number>();

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

type ExportProject = typeof schema.projects.$inferSelect;

function writeSseEvent(res: import('express').Response, payload: unknown, eventName = 'progress'): void {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toExportLanguages(body: ExportRequest): string[] {
  if (Array.isArray(body.languages) && body.languages.length > 0) {
    return dedupeLanguageCodes(body.languages);
  }

  if (body.language === 'both') {
    return ['zh', 'en'];
  }

  if (body.language === 'zh' || body.language === 'en') {
    return [body.language];
  }

  return [...DEFAULT_EXPORT_LANGUAGES];
}

function isDeviceSizeId(id: string): id is DeviceSizeId {
  return id in DEVICE_SIZES;
}

function isTemplateStyleId(id: string): id is TemplateStyleId {
  return id in TEMPLATES;
}

function toDeviceSizes(deviceIds: DeviceSizeId[] | undefined): Array<(typeof DEVICE_SIZES)[DeviceSizeId]> {
  const ids = (deviceIds && deviceIds.length > 0 ? deviceIds : ['6.7']) as string[];
  return ids.filter(isDeviceSizeId).map((id) => DEVICE_SIZES[id]);
}

function resolveTemplate(templateId: string | null | undefined): (typeof TEMPLATES)[TemplateStyleId] {
  if (templateId && isTemplateStyleId(templateId)) {
    return TEMPLATES[templateId];
  }
  return TEMPLATES.clean;
}

function buildExportFilename(appName: string, suffix: string): string {
  const safeName = appName.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_') || 'app';
  return `${safeName}_${suffix}.zip`;
}

function getAdvancedExportThrottleKey(projectId: string, sessionId: string, userId?: string): string {
  return `${projectId}:${userId ?? `session:${sessionId}`}`;
}

function getAdvancedExportCooldownLeftMs(projectId: string, sessionId: string, userId?: string): number {
  const key = getAdvancedExportThrottleKey(projectId, sessionId, userId);
  const lastRequestAt = advancedExportLastRequestAt.get(key);
  if (!lastRequestAt) return 0;
  const diff = Date.now() - lastRequestAt;
  return diff >= ADVANCED_EXPORT_COOLDOWN_MS ? 0 : ADVANCED_EXPORT_COOLDOWN_MS - diff;
}

function markAdvancedExportRequested(projectId: string, sessionId: string, userId?: string): void {
  const key = getAdvancedExportThrottleKey(projectId, sessionId, userId);
  advancedExportLastRequestAt.set(key, Date.now());
}

function buildExportPayload(project: ExportProject, body: ExportRequest): {
  screenshots: Buffer[];
  copy: GeneratedCopy;
  template: (typeof TEMPLATES)[keyof typeof TEMPLATES];
  deviceSizes: Array<(typeof DEVICE_SIZES)[DeviceSizeId]>;
  languages: string[];
  includeWatermark: boolean;
  watermarkText: string;
  fileCount: number;
} {
  const screenshotPaths = safeParseJson<string[]>(project.screenshotPaths, []);
  if (screenshotPaths.length === 0) {
    throw new Error('No screenshots found for this project');
  }

  const copy = safeParseJson<GeneratedCopy | null>(project.generatedCopy, null);
  if (!copy) {
    throw new Error('Run analysis first');
  }

  const deviceSizes = toDeviceSizes(body.deviceSizes);
  if (deviceSizes.length === 0) {
    throw new Error('No valid device size selected');
  }

  const languages = toExportLanguages(body);
  const template = resolveTemplate(project.templateStyle);
  const screenshots = screenshotPaths.map((filename) => fs.readFileSync(path.join(uploadsDir, filename)));
  const fileCount = screenshots.length * deviceSizes.length * languages.length;

  return {
    screenshots,
    copy,
    template,
    deviceSizes,
    languages,
    includeWatermark: body.includeWatermark ?? true,
    watermarkText: body.watermarkText?.trim() || 'appshots',
    fileCount,
  };
}

async function runExportJob(jobId: string, projectId: string, body: ExportRequest): Promise<void> {
  try {
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
    if (!project) {
      throw new Error('Project not found');
    }

    updateExportJob(jobId, {
      status: 'running',
      stage: 'preparing',
      progress: 5,
      message: '正在读取项目素材...',
    });

    const payload = buildExportPayload(project, body);

    updateExportJob(jobId, {
      status: 'running',
      stage: 'rendering',
      progress: 8,
      message: '正在渲染截图...',
    });

    const zipBuffer = await generateExportZip({
      screenshots: payload.screenshots,
      copy: payload.copy,
      template: payload.template,
      deviceSizes: payload.deviceSizes,
      languages: payload.languages,
      includeWatermark: payload.includeWatermark,
      watermarkText: payload.watermarkText,
      appName: project.appName,
      onProgress: (progress) => {
        if (progress.stage === 'rendering') {
          updateExportJob(jobId, {
            status: 'running',
            stage: 'rendering',
            progress: Math.max(8, progress.progress),
            message: `正在渲染截图 ${progress.completedItems}/${progress.totalItems}...`,
          });
          return;
        }

        updateExportJob(jobId, {
          status: 'running',
          stage: 'packaging',
          progress: progress.progress,
          message: '正在打包 ZIP 文件...',
        });
      },
    });

    updateExportJob(jobId, {
      status: 'running',
      stage: 'saving',
      progress: 99,
      message: '正在保存导出文件...',
    });

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const suffix = `${Date.now()}_${jobId}`;
    const filename = buildExportFilename(project.appName, suffix);
    const filepath = path.join(exportsDir, filename);
    fs.writeFileSync(filepath, zipBuffer);

    completeExportJob(jobId, {
      zipUrl: `/api/export/${filename}`,
      fileCount: payload.fileCount,
      totalSizeBytes: zipBuffer.length,
      message: `导出完成，共 ${payload.fileCount} 张图片。`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    failExportJob(jobId, message);
  }
}

function getLocalizedCopyText(
  variants: GeneratedCopy['headlines'] | undefined,
  screenshotIndex: number,
  language: string,
): string {
  if (!variants || variants.length === 0) return '';
  const variant = variants.find((item) => item.screenshotIndex === screenshotIndex) ?? variants[screenshotIndex];
  if (!variant) return '';

  const normalized = normalizeLanguageCode(language);
  const keys = [normalized, normalized.split('-')[0], 'zh', 'en'];
  for (const key of keys) {
    if (!key) continue;
    const value = variant[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
}

// Preview a single composed screenshot (login required)
router.get('/projects/:id/preview/:index', requireAuth, async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const userId = getUserId(req);
    const projectId = getRouteParam(req.params.id);
    const scope = projectScope(projectId, sessionId, userId);
    const [project] = await db.select().from(schema.projects).where(scope);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const screenshotPaths = safeParseJson<string[]>(project.screenshotPaths, []);
    const index = parseInt(getRouteParam(req.params.index), 10);
    if (index < 0 || index >= screenshotPaths.length) {
      res.status(400).json({ message: 'Invalid screenshot index' });
      return;
    }

    const templateId = (req.query.template as string) || project.templateStyle || 'clean';
    const lang = normalizeLanguageCode((req.query.lang as string) || 'zh');
    const deviceId = (req.query.device as string) || '6.7';

    const template = resolveTemplate(templateId);
    const deviceSize = DEVICE_SIZES[deviceId as DeviceSizeId];
    if (!deviceSize) {
      res.status(400).json({ message: 'Invalid device size' });
      return;
    }

    const copy = safeParseJson<GeneratedCopy | null>(project.generatedCopy, null);
    const headline = getLocalizedCopyText(copy?.headlines, index, lang);
    const subtitle = getLocalizedCopyText(copy?.subtitles, index, lang);

    const screenshotBuffer = fs.readFileSync(path.join(uploadsDir, screenshotPaths[index]));

    const composed = await composeScreenshot({
      screenshotBuffer,
      screenshotIndex: index,
      totalScreenshots: screenshotPaths.length,
      headline,
      subtitle,
      template,
      deviceSize,
      includeWatermark: true,
      watermarkText: 'appshots',
    });

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(composed);
  } catch (err) {
    next(err);
  }
});

// Start export job (login required)
router.post('/projects/:id/export/jobs', requireAuth, async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const userId = getUserId(req);
    const isMember = getIsMember(req);
    const projectId = getRouteParam(req.params.id);
    const scope = projectScope(projectId, sessionId, userId);
    const [project] = await db.select().from(schema.projects).where(scope);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const body = req.body as ExportRequest;

    // Free user constraints: force watermark, restrict to single language
    if (!isMember) {
      body.includeWatermark = true;
      body.languages = ['zh'];
      body.language = 'zh';
    }

    // No-watermark export requires membership
    if (body.includeWatermark === false && !isMember) {
      res.status(403).json({ message: '无水印导出仅限会员使用' });
      return;
    }

    if (body.includeWatermark === false) {
      const cooldownLeftMs = getAdvancedExportCooldownLeftMs(projectId, sessionId, userId);
      if (cooldownLeftMs > 0) {
        const waitMinutes = Math.ceil(cooldownLeftMs / 60000);
        res.status(429).json({ message: `高级导出调用过于频繁，请 ${waitMinutes} 分钟后再试` });
        return;
      }
    }

    // Fast pre-check to fail early before creating a background job.
    if (!project.generatedCopy) {
      res.status(400).json({ message: 'Run analysis first' });
      return;
    }

    const screenshotPaths = safeParseJson<string[]>(project.screenshotPaths, []);
    if (screenshotPaths.length === 0) {
      res.status(400).json({ message: 'Upload screenshots first' });
      return;
    }

    if (body.includeWatermark === false) {
      markAdvancedExportRequested(projectId, sessionId, userId);
    }

    const job = createExportJob(projectId, sessionId);
    void runExportJob(job.jobId, projectId, body);

    res.status(202).json(job);
  } catch (err) {
    next(err);
  }
});

// Query export job progress
router.get('/export/jobs/:jobId', (req, res) => {
  const jobId = getRouteParam(req.params.jobId);
  const job = getExportJob(jobId);
  if (!job) {
    res.status(404).json({ message: 'Export job not found or expired' });
    return;
  }

  res.json(job);
});

// Stream export job progress (SSE)
router.get('/export/jobs/:jobId/stream', (req, res) => {
  const jobId = getRouteParam(req.params.jobId);
  const current = getExportJob(jobId);
  if (!current) {
    res.status(404).json({ message: 'Export job not found or expired' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  writeSseEvent(res, current);

  if (current.status === 'completed' || current.status === 'failed') {
    res.end();
    return;
  }

  let isClosed = false;

  const cleanup = () => {
    if (isClosed) return;
    isClosed = true;
    clearInterval(heartbeat);
    unsubscribe();
  };

  const unsubscribe = subscribeExportJob(jobId, (job) => {
    if (isClosed) return;

    writeSseEvent(res, job);

    if (job.status === 'completed' || job.status === 'failed') {
      cleanup();
      res.end();
    }
  });

  const heartbeat = setInterval(() => {
    if (isClosed) return;
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    cleanup();
  });
});

// Legacy export API (login required)
router.post('/projects/:id/export', requireAuth, async (req, res, next) => {
  try {
    const sessionId = getSessionId(req);
    const userId = getUserId(req);
    const isMember = getIsMember(req);
    const projectId = getRouteParam(req.params.id);
    const scope = projectScope(projectId, sessionId, userId);
    const [project] = await db.select().from(schema.projects).where(scope);
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const body = req.body as ExportRequest;

    // Free user constraints
    if (!isMember) {
      body.includeWatermark = true;
      body.languages = ['zh'];
      body.language = 'zh';
    }

    if (body.includeWatermark === false && !isMember) {
      res.status(403).json({ message: '无水印导出仅限会员使用' });
      return;
    }

    if (body.includeWatermark === false) {
      const cooldownLeftMs = getAdvancedExportCooldownLeftMs(projectId, sessionId, userId);
      if (cooldownLeftMs > 0) {
        const waitMinutes = Math.ceil(cooldownLeftMs / 60000);
        res.status(429).json({ message: `高级导出调用过于频繁，请 ${waitMinutes} 分钟后再试` });
        return;
      }

      markAdvancedExportRequested(projectId, sessionId, userId);
    }

    const payload = buildExportPayload(project, body);

    const zipBuffer = await generateExportZip({
      screenshots: payload.screenshots,
      copy: payload.copy,
      template: payload.template,
      deviceSizes: payload.deviceSizes,
      languages: payload.languages,
      includeWatermark: payload.includeWatermark,
      watermarkText: payload.watermarkText,
      appName: project.appName,
    });

    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filename = buildExportFilename(project.appName, `${Date.now()}`);
    const filepath = path.join(exportsDir, filename);
    fs.writeFileSync(filepath, zipBuffer);

    res.json({
      zipUrl: `/api/export/${filename}`,
      fileCount: payload.fileCount,
      totalSizeBytes: zipBuffer.length,
    });
  } catch (err) {
    next(err);
  }
});

// Download export ZIP
router.get('/export/:filename', (req, res) => {
  const filepath = path.join(exportsDir, getRouteParam(req.params.filename));
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ message: 'File not found' });
    return;
  }
  res.download(filepath);
});

export { router as exportRoutes };
