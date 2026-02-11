import sharp from 'sharp';

const MIN_PORTRAIT_RATIO = 1.58;
const TOP_INSET_RATIO = 0.045;
const BOTTOM_INSET_RATIO = 0.038;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shouldTrimSystemBars(width: number, height: number): boolean {
  if (!width || !height) return false;
  if (height <= width) return false;
  return height / width >= MIN_PORTRAIT_RATIO;
}

function calcInset(height: number, ratio: number, minPx: number): number {
  const maxPx = Math.round(height * 0.08);
  return clamp(Math.round(height * ratio), minPx, Math.max(minPx, maxPx));
}

/**
 * Removes mobile status/navigation bars from portrait screenshots so generated
 * marketing assets focus on app content.
 */
export async function sanitizeScreenshotBuffer(input: Buffer): Promise<Buffer> {
  const rotated = await sharp(input)
    .rotate()
    .toBuffer({ resolveWithObject: true });

  const width = rotated.info.width ?? 0;
  const height = rotated.info.height ?? 0;

  if (!shouldTrimSystemBars(width, height)) {
    return rotated.data;
  }

  const topInset = calcInset(height, TOP_INSET_RATIO, 36);
  const bottomInset = calcInset(height, BOTTOM_INSET_RATIO, 28);
  const cropHeight = height - topInset - bottomInset;

  if (cropHeight < 64) {
    return rotated.data;
  }

  return sharp(rotated.data)
    .extract({
      left: 0,
      top: topInset,
      width,
      height: cropHeight,
    })
    .toBuffer();
}
