import archiver from 'archiver';
import { PassThrough } from 'stream';
import os from 'os';
import { composeScreenshot } from './imageComposer.js';
import type { TemplateConfig, DeviceSize, GeneratedCopy } from '@appshots/shared';

export interface ExportZipProgress {
  stage: 'rendering' | 'packaging';
  completedItems: number;
  totalItems: number;
  progress: number;
  deviceId?: string;
  language?: string;
  screenshotIndex?: number;
}

function toRenderingProgress(completedItems: number, totalItems: number): number {
  if (totalItems <= 0) return 90;
  return Math.min(95, Math.round((completedItems / totalItems) * 90));
}

interface RenderTask {
  screenshotIndex: number;
  screenshotBuffer: Buffer;
  language: string;
  deviceSize: DeviceSize;
  headline: string;
  subtitle: string;
}

function getRenderConcurrency(taskCount: number): number {
  const cpuCount = Math.max(1, os.cpus().length);
  return Math.min(taskCount, Math.max(2, Math.min(8, cpuCount)));
}

export async function generateExportZip(options: {
  screenshots: Buffer[];
  copy: GeneratedCopy;
  template: TemplateConfig;
  deviceSizes: DeviceSize[];
  languages: string[];
  includeWatermark: boolean;
  watermarkText?: string;
  appName: string;
  onProgress?: (progress: ExportZipProgress) => void;
}): Promise<Buffer> {
  const { screenshots, copy, template, deviceSizes, languages, includeWatermark, watermarkText, appName, onProgress } = options;

  const archive = archiver('zip', { zlib: { level: 6 } });
  const buffers: Buffer[] = [];
  const passthrough = new PassThrough();

  const completion = new Promise<Buffer>((resolve, reject) => {
    passthrough.on('data', (chunk: Buffer) => buffers.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(buffers)));
    passthrough.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(passthrough);

  const totalItems = Math.max(1, screenshots.length * deviceSizes.length * languages.length);
  let completedItems = 0;

  const findVariant = (variants: GeneratedCopy['headlines'], screenshotIndex: number) =>
    variants.find((item) => item.screenshotIndex === screenshotIndex) ?? variants[screenshotIndex];

  const getLocalizedText = (variants: GeneratedCopy['headlines'], screenshotIndex: number, language: string): string => {
    const variant = findVariant(variants, screenshotIndex);
    if (!variant) return '';

    const lang = language.toLowerCase();
    const fallbackKeys = [lang, lang.split('-')[0], 'zh', 'en'];
    for (const key of fallbackKeys) {
      if (!key) continue;
      const value = variant[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
    return '';
  };

  const tasks: RenderTask[] = [];
  for (const deviceSize of deviceSizes) {
    for (const language of languages) {
      for (let screenshotIndex = 0; screenshotIndex < screenshots.length; screenshotIndex += 1) {
        tasks.push({
          screenshotIndex,
          screenshotBuffer: screenshots[screenshotIndex],
          language,
          deviceSize,
          headline: getLocalizedText(copy.headlines, screenshotIndex, language),
          subtitle: getLocalizedText(copy.subtitles, screenshotIndex, language),
        });
      }
    }
  }

  let cursor = 0;
  const workerCount = getRenderConcurrency(tasks.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const taskIndex = cursor;
        cursor += 1;
        if (taskIndex >= tasks.length) {
          return;
        }

        const task = tasks[taskIndex];
        const composedBuffer = await composeScreenshot({
          screenshotBuffer: task.screenshotBuffer,
          screenshotIndex: task.screenshotIndex,
          totalScreenshots: screenshots.length,
          headline: task.headline,
          subtitle: task.subtitle,
          template,
          deviceSize: task.deviceSize,
          includeWatermark,
          watermarkText,
        });

        const filename = `${appName}_${task.deviceSize.id}in_${task.language}_${task.screenshotIndex + 1}.png`;
        const folder = `${task.deviceSize.id}inch/${task.language}`;
        archive.append(composedBuffer, { name: `${folder}/${filename}` });

        completedItems += 1;
        onProgress?.({
          stage: 'rendering',
          completedItems,
          totalItems,
          progress: toRenderingProgress(completedItems, totalItems),
          deviceId: task.deviceSize.id,
          language: task.language,
          screenshotIndex: task.screenshotIndex,
        });
      }
    }),
  );

  onProgress?.({
    stage: 'packaging',
    completedItems,
    totalItems,
    progress: 96,
  });

  await archive.finalize();

  onProgress?.({
    stage: 'packaging',
    completedItems,
    totalItems,
    progress: 99,
  });

  return completion;
}
