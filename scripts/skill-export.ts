import fs from 'fs';
import path from 'path';
import os from 'os';
import process from 'process';
import {
  DEFAULT_EXPORT_LANGUAGES,
  DEVICE_SIZES,
  TEMPLATES,
  dedupeLanguageCodes,
  normalizeLanguageCode,
} from '../packages/shared/src/index.ts';
import type { CopyVariant, DeviceSizeId, GeneratedCopy, TemplateStyleId } from '../packages/shared/src/index.ts';
import { composeScreenshot } from '../server/src/services/imageComposer.ts';

interface CliOptions {
  images: string[];
  imagesDir?: string;
  copyPath?: string;
  outDir: string;
  appName: string;
  template: TemplateStyleId;
  languages: string[];
  sizes: DeviceSizeId[];
  includeWatermark: boolean;
  watermarkText: string;
}

interface RenderTask {
  screenshotIndex: number;
  screenshotBuffer: Buffer;
  language: string;
  sizeId: DeviceSizeId;
  outputPath: string;
  headline: string;
  subtitle: string;
}

function printHelp(): void {
  console.log(`\nappshots skill export CLI\n\nUsage:\n  pnpm skill:export -- --images "./shots/1.png,./shots/2.png" --copy ./examples/copy.json --out-dir ./output\n\nOptions:\n  --images           Comma-separated image file paths\n  --images-dir       Directory containing screenshot images (png/jpg/jpeg/webp)\n  --copy             Path to copy JSON (GeneratedCopy shape or items shape)\n  --template         Template id (default: clean)\n  --languages        Comma-separated language codes (default: zh,en,pt,ja,ko)\n  --sizes            Comma-separated size ids (default: 6.7)\n  --out-dir          Output directory (required)\n  --app-name         Output filename prefix (default: appshots)\n  --include-watermark  true | false (default: true)\n  --watermark-text   Watermark text (default: appshots)\n  --help             Show this help\n\nSupported size ids:\n  ${Object.keys(DEVICE_SIZES).join(', ')}\n\nSupported template ids:\n  ${Object.keys(TEMPLATES).join(', ')}\n`);
}

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = 'true';
      continue;
    }

    result[key] = next;
    i += 1;
  }
  return result;
}

function parseBoolean(input: string | undefined, fallback: boolean): boolean {
  if (!input) return fallback;
  const value = input.trim().toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes') return true;
  if (value === 'false' || value === '0' || value === 'no') return false;
  return fallback;
}

function splitCsv(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSizes(input: string | undefined): DeviceSizeId[] {
  const raw = splitCsv(input);
  const resolved = (raw.length > 0 ? raw : ['6.7']).filter((id): id is DeviceSizeId => id in DEVICE_SIZES);
  if (resolved.length === 0) {
    throw new Error(`No valid size ids. Allowed: ${Object.keys(DEVICE_SIZES).join(', ')}`);
  }
  return resolved;
}

function parseTemplate(input: string | undefined): TemplateStyleId {
  const template = (input || 'clean').trim();
  if (!(template in TEMPLATES)) {
    throw new Error(`Invalid template: ${template}. Allowed: ${Object.keys(TEMPLATES).join(', ')}`);
  }
  return template as TemplateStyleId;
}

function collectImages(images: string[], imagesDir?: string): string[] {
  const byPath = images
    .map((filePath) => path.resolve(filePath))
    .filter((filePath) => fs.existsSync(filePath) && fs.statSync(filePath).isFile());

  const byDir: string[] = [];
  if (imagesDir) {
    const dir = path.resolve(imagesDir);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new Error(`images-dir does not exist or is not a directory: ${imagesDir}`);
    }

    const entries = fs
      .readdirSync(dir)
      .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, 'en'))
      .map((name) => path.join(dir, name));

    byDir.push(...entries);
  }

  const unique = Array.from(new Set([...byPath, ...byDir]));
  if (unique.length === 0) {
    throw new Error('No valid images found. Provide --images or --images-dir');
  }

  return unique;
}

function toCopyVariant(raw: unknown, screenshotIndex: number): CopyVariant {
  const base: CopyVariant = { screenshotIndex };
  if (!raw || typeof raw !== 'object') return base;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (key === 'screenshotIndex') continue;
    if (typeof value === 'string') {
      base[normalizeLanguageCode(key)] = value;
    }
  }

  return base;
}

function normalizeCopy(raw: unknown, screenshotCount: number): GeneratedCopy {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const normalizeByArray = (input: unknown): CopyVariant[] => {
    if (!Array.isArray(input)) return [];
    return input.map((item, index) => {
      const idx =
        item && typeof item === 'object' && typeof (item as { screenshotIndex?: unknown }).screenshotIndex === 'number'
          ? ((item as { screenshotIndex: number }).screenshotIndex ?? index)
          : index;
      return toCopyVariant(item, idx);
    });
  };

  if (Array.isArray(source.headlines) || Array.isArray(source.subtitles)) {
    const headlinesRaw = normalizeByArray(source.headlines);
    const subtitlesRaw = normalizeByArray(source.subtitles);

    const headlines = Array.from({ length: screenshotCount }, (_, index) => {
      const hit = headlinesRaw.find((item) => item.screenshotIndex === index);
      return hit ?? { screenshotIndex: index };
    });

    const subtitles = Array.from({ length: screenshotCount }, (_, index) => {
      const hit = subtitlesRaw.find((item) => item.screenshotIndex === index);
      return hit ?? { screenshotIndex: index };
    });

    return {
      headlines,
      subtitles,
      tagline: typeof source.tagline === 'object' && source.tagline ? (source.tagline as Record<string, string>) : {},
    };
  }

  if (Array.isArray(source.items)) {
    const items = source.items as Array<Record<string, unknown>>;
    const headlines = Array.from({ length: screenshotCount }, (_, index) => {
      const item = items[index] || {};
      if (typeof item.headline === 'string') {
        return { screenshotIndex: index, zh: item.headline } as CopyVariant;
      }
      return toCopyVariant(item.headline, index);
    });

    const subtitles = Array.from({ length: screenshotCount }, (_, index) => {
      const item = items[index] || {};
      if (typeof item.subtitle === 'string') {
        return { screenshotIndex: index, zh: item.subtitle } as CopyVariant;
      }
      return toCopyVariant(item.subtitle, index);
    });

    return { headlines, subtitles, tagline: {} };
  }

  return {
    headlines: Array.from({ length: screenshotCount }, (_, index) => ({ screenshotIndex: index })),
    subtitles: Array.from({ length: screenshotCount }, (_, index) => ({ screenshotIndex: index })),
    tagline: {},
  };
}

function readCopy(copyPath: string | undefined, screenshotCount: number): GeneratedCopy {
  if (!copyPath) {
    return {
      headlines: Array.from({ length: screenshotCount }, (_, index) => ({ screenshotIndex: index })),
      subtitles: Array.from({ length: screenshotCount }, (_, index) => ({ screenshotIndex: index })),
      tagline: {},
    };
  }

  const resolved = path.resolve(copyPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Copy file not found: ${copyPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, 'utf8')) as unknown;
  return normalizeCopy(raw, screenshotCount);
}

function getLocalizedText(variants: CopyVariant[], screenshotIndex: number, language: string): string {
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

function buildOptions(args: Record<string, string>): CliOptions {
  const outDir = args['out-dir']?.trim();
  if (!outDir) {
    throw new Error('--out-dir is required');
  }

  const images = splitCsv(args.images);
  const resolvedImages = collectImages(images, args['images-dir']);

  return {
    images: resolvedImages,
    imagesDir: args['images-dir'],
    copyPath: args.copy,
    outDir: path.resolve(outDir),
    appName: (args['app-name'] || 'appshots').trim() || 'appshots',
    template: parseTemplate(args.template),
    languages: dedupeLanguageCodes(splitCsv(args.languages), DEFAULT_EXPORT_LANGUAGES),
    sizes: parseSizes(args.sizes),
    includeWatermark: parseBoolean(args['include-watermark'], true),
    watermarkText: (args['watermark-text'] || 'appshots').trim() || 'appshots',
  };
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const options = buildOptions(args);
  const template = TEMPLATES[options.template];

  const screenshotBuffers = options.images.map((imagePath) => fs.readFileSync(imagePath));
  const copy = readCopy(options.copyPath, screenshotBuffers.length);

  const tasks: RenderTask[] = [];
  for (const sizeId of options.sizes) {
    for (const language of options.languages) {
      for (let screenshotIndex = 0; screenshotIndex < screenshotBuffers.length; screenshotIndex += 1) {
        const safeAppName = sanitizeName(options.appName);
        const outputDir = path.join(options.outDir, `${sizeId}inch`, language);
        const outputPath = path.join(outputDir, `${safeAppName}_${sizeId}_${language}_${screenshotIndex + 1}.png`);

        tasks.push({
          screenshotIndex,
          screenshotBuffer: screenshotBuffers[screenshotIndex],
          language,
          sizeId,
          outputPath,
          headline: getLocalizedText(copy.headlines, screenshotIndex, language),
          subtitle: getLocalizedText(copy.subtitles, screenshotIndex, language),
        });
      }
    }
  }

  const workers = Math.min(tasks.length, Math.max(2, Math.min(8, os.cpus().length)));
  let cursor = 0;
  let completed = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= tasks.length) return;

        const task = tasks[index];
        const deviceSize = DEVICE_SIZES[task.sizeId];

        const png = await composeScreenshot({
          screenshotBuffer: task.screenshotBuffer,
          screenshotIndex: task.screenshotIndex,
          totalScreenshots: screenshotBuffers.length,
          headline: task.headline,
          subtitle: task.subtitle,
          template,
          deviceSize,
          includeWatermark: options.includeWatermark,
          watermarkText: options.watermarkText,
        });

        fs.mkdirSync(path.dirname(task.outputPath), { recursive: true });
        fs.writeFileSync(task.outputPath, png);

        completed += 1;
        console.log(`[${completed}/${tasks.length}] ${task.outputPath}`);
      }
    }),
  );

  console.log('\nDone.');
  console.log(`Output directory: ${options.outDir}`);
  console.log(`Images: ${screenshotBuffers.length}`);
  console.log(`Languages: ${options.languages.join(', ')}`);
  console.log(`Sizes: ${options.sizes.join(', ')}`);
  console.log(`Template: ${options.template}`);
}

run().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
