import sharp from 'sharp';
import type { DeviceSize, GradientConfig, TemplateConfig, TemplateStyleId } from '@appshots/shared';

type LayoutVariant = 'hero-top' | 'hero-bottom' | 'edge-flow' | 'story-slice';
type TextAlignment = 'left' | 'center';

interface LayoutContext {
  screenshotBuffer: Buffer;
  headline: string;
  subtitle: string;
  template: TemplateConfig;
  deviceSize: DeviceSize;
  screenshotIndex: number;
  totalScreenshots: number;
}

interface PreparedScreenshot {
  buffer: Buffer;
  width: number;
  height: number;
}

interface TextSvgOptions {
  width: number;
  height: number;
  headline: string;
  subtitle: string;
  template: TemplateConfig;
  align?: TextAlignment;
  paddingX?: number;
  headlineScale?: number;
  subtitleScale?: number;
  maxHeadlineLines?: number;
  maxSubtitleLines?: number;
  panelFill?: string;
  panelOpacity?: number;
  panelInset?: number;
  panelRadius?: number;
}

const TEMPLATE_LAYOUT_CYCLES: Partial<Record<TemplateStyleId, LayoutVariant[]>> = {
  clean: ['hero-top', 'edge-flow', 'hero-bottom'],
  'tech-dark': ['story-slice', 'hero-top', 'story-slice', 'hero-bottom'],
  vibrant: ['edge-flow', 'hero-top', 'edge-flow'],
  aurora: ['story-slice', 'hero-top', 'story-slice', 'hero-bottom'],
  'sunset-glow': ['hero-bottom', 'edge-flow', 'hero-top'],
  'forest-mist': ['hero-top', 'edge-flow', 'hero-bottom'],
  'rose-gold': ['hero-bottom', 'edge-flow', 'hero-top'],
  'monochrome-bold': ['story-slice', 'hero-bottom', 'story-slice'],
  'ocean-breeze': ['hero-top', 'edge-flow', 'hero-bottom'],
  'neon-pulse': ['story-slice', 'edge-flow', 'hero-top'],
  'lavender-dream': ['hero-bottom', 'edge-flow', 'hero-top'],
  'desert-sand': ['hero-top', 'edge-flow', 'hero-bottom'],
  'midnight-purple': ['story-slice', 'hero-top', 'story-slice', 'hero-bottom'],
  'candy-pop': ['edge-flow', 'hero-top', 'hero-bottom'],
};

const DEFAULT_LAYOUT_CYCLE: LayoutVariant[] = ['hero-top', 'edge-flow', 'hero-bottom'];

export async function composeScreenshot(options: {
  screenshotBuffer: Buffer;
  screenshotIndex?: number;
  totalScreenshots?: number;
  headline: string;
  subtitle: string;
  template: TemplateConfig;
  deviceSize: DeviceSize;
  includeWatermark: boolean;
  watermarkText?: string;
}): Promise<Buffer> {
  const {
    screenshotBuffer,
    screenshotIndex = 0,
    totalScreenshots = 1,
    headline,
    subtitle,
    template,
    deviceSize,
    includeWatermark,
    watermarkText,
  } = options;

  const safeIndex = Math.max(0, screenshotIndex);
  const safeTotal = Math.max(1, totalScreenshots);
  const { width, height } = deviceSize;

  const backgroundSvg = createBackgroundSvg(width, height, template.backgroundColor);
  const background = sharp(Buffer.from(backgroundSvg)).resize(width, height).png();

  const context: LayoutContext = {
    screenshotBuffer,
    headline,
    subtitle,
    template,
    deviceSize,
    screenshotIndex: safeIndex,
    totalScreenshots: safeTotal,
  };

  const layout = resolveLayoutVariant(template, safeIndex);
  let layoutComposites: sharp.OverlayOptions[];

  try {
    layoutComposites = await renderLayout(layout, context);
  } catch {
    const fallbackLayout: LayoutVariant = template.textPosition === 'bottom' ? 'hero-bottom' : 'hero-top';
    layoutComposites = await renderLayout(fallbackLayout, context);
  }

  const overlaySvg =
    template.compositionMode === 'story-slice'
      ? createStorySliceOverlaySvg(width, height, template, safeIndex, safeTotal)
      : createFlowOverlaySvg(width, height, template, safeIndex, safeTotal);

  const composites: sharp.OverlayOptions[] = [
    { input: Buffer.from(overlaySvg), left: 0, top: 0 },
    ...layoutComposites,
  ];

  if (includeWatermark) {
    composites.push({
      input: Buffer.from(createWatermarkSvg(width, height, watermarkText || 'appshots')),
      left: 0,
      top: 0,
    });
  }

  return background.composite(composites).png().toBuffer();
}

async function renderLayout(layout: LayoutVariant, context: LayoutContext): Promise<sharp.OverlayOptions[]> {
  if (layout === 'hero-bottom') {
    return renderHeroBottomLayout(context);
  }

  if (layout === 'edge-flow') {
    return renderEdgeFlowLayout(context);
  }

  if (layout === 'story-slice') {
    return renderStorySliceLayout(context);
  }

  return renderHeroTopLayout(context);
}

async function renderHeroTopLayout(context: LayoutContext): Promise<sharp.OverlayOptions[]> {
  const { screenshotBuffer, headline, subtitle, template, deviceSize } = context;
  const { width, height } = deviceSize;

  const textAreaHeight = Math.round(height * 0.24);
  const screenshotAreaTop = textAreaHeight + Math.round(height * 0.02);
  const screenshotAreaHeight = height - screenshotAreaTop - Math.round(height * 0.05);

  const screenshot = await prepareScreenshot(
    screenshotBuffer,
    Math.round(width * clamp(template.screenshotScale + 0.05, 0.66, 0.86)),
    Math.round(screenshotAreaHeight * 0.95),
    Math.round(width * 0.024),
  );

  const screenshotLeft = Math.round((width - screenshot.width) / 2);
  const screenshotTop = screenshotAreaTop + Math.round((screenshotAreaHeight - screenshot.height) / 2);

  const textSvg = createTextSvg({
    width,
    height: textAreaHeight,
    headline,
    subtitle,
    template,
    align: 'center',
    paddingX: Math.round(width * 0.08),
    headlineScale: width >= 1500 ? 0.053 : 0.058,
    subtitleScale: width >= 1500 ? 0.03 : 0.033,
    maxHeadlineLines: 2,
    maxSubtitleLines: 2,
  });

  return [
    { input: screenshot.buffer, left: screenshotLeft, top: screenshotTop },
    { input: Buffer.from(textSvg), left: 0, top: 0 },
  ];
}

async function renderHeroBottomLayout(context: LayoutContext): Promise<sharp.OverlayOptions[]> {
  const { screenshotBuffer, headline, subtitle, template, deviceSize } = context;
  const { width, height } = deviceSize;

  const textAreaHeight = Math.round(height * 0.2);
  const screenshotAreaTop = Math.round(height * 0.05);
  const screenshotAreaHeight = height - textAreaHeight - screenshotAreaTop - Math.round(height * 0.03);

  const screenshot = await prepareScreenshot(
    screenshotBuffer,
    Math.round(width * clamp(template.screenshotScale + 0.04, 0.65, 0.84)),
    Math.round(screenshotAreaHeight),
    Math.round(width * 0.024),
  );

  const screenshotLeft = Math.round((width - screenshot.width) / 2);
  const screenshotTop = screenshotAreaTop + Math.round((screenshotAreaHeight - screenshot.height) / 2);

  const textSvg = createTextSvg({
    width,
    height: textAreaHeight,
    headline,
    subtitle,
    template,
    align: 'left',
    paddingX: Math.round(width * 0.1),
    headlineScale: width >= 1500 ? 0.049 : 0.054,
    subtitleScale: width >= 1500 ? 0.028 : 0.031,
    maxHeadlineLines: 2,
    maxSubtitleLines: 2,
    panelFill: getTextPanelFill(template.textColor),
    panelOpacity: 0.34,
    panelInset: Math.round(width * 0.03),
    panelRadius: Math.round(width * 0.03),
  });

  return [
    { input: screenshot.buffer, left: screenshotLeft, top: screenshotTop },
    { input: Buffer.from(textSvg), left: 0, top: height - textAreaHeight },
  ];
}

async function renderEdgeFlowLayout(context: LayoutContext): Promise<sharp.OverlayOptions[]> {
  const { screenshotBuffer, headline, subtitle, template, deviceSize, screenshotIndex, totalScreenshots } = context;
  const { width, height } = deviceSize;

  const textAreaHeight = Math.round(height * 0.21);
  const screenshotAreaTop = textAreaHeight + Math.round(height * 0.02);
  const screenshotAreaHeight = height - screenshotAreaTop - Math.round(height * 0.03);

  const screenshot = await prepareScreenshot(
    screenshotBuffer,
    Math.round(width * clamp(template.screenshotScale + 0.18, 0.78, 0.98)),
    Math.round(screenshotAreaHeight),
    Math.round(width * 0.024),
  );

  const baseLeft = Math.round((width - screenshot.width) / 2);
  const drift = resolveScreenDrift(width, screenshotIndex, totalScreenshots);
  const screenshotLeft = clamp(
    baseLeft + drift,
    -Math.round(width * 0.26),
    width - screenshot.width + Math.round(width * 0.26),
  );
  const screenshotTop = screenshotAreaTop + Math.round((screenshotAreaHeight - screenshot.height) / 2);

  const align: TextAlignment = screenshotLeft < baseLeft ? 'center' : 'left';
  const textSvg = createTextSvg({
    width,
    height: textAreaHeight,
    headline,
    subtitle,
    template,
    align,
    paddingX: Math.round(width * 0.09),
    headlineScale: width >= 1500 ? 0.051 : 0.055,
    subtitleScale: width >= 1500 ? 0.029 : 0.032,
    maxHeadlineLines: 2,
    maxSubtitleLines: 2,
  });

  return [
    { input: screenshot.buffer, left: screenshotLeft, top: screenshotTop },
    { input: Buffer.from(textSvg), left: 0, top: 0 },
  ];
}

async function renderStorySliceLayout(context: LayoutContext): Promise<sharp.OverlayOptions[]> {
  const { screenshotBuffer, headline, subtitle, template, deviceSize, screenshotIndex, totalScreenshots } = context;
  const { width, height } = deviceSize;

  const textAreaHeight = Math.round(height * 0.2);
  const screenshotAreaTop = textAreaHeight + Math.round(height * 0.02);
  const screenshotAreaHeight = height - screenshotAreaTop - Math.round(height * 0.04);

  const screenshot = await prepareScreenshot(
    screenshotBuffer,
    Math.round(width * clamp(template.screenshotScale + 0.12, 0.76, 0.93)),
    Math.round(screenshotAreaHeight),
    Math.round(width * 0.024),
  );

  const baseLeft = Math.round((width - screenshot.width) / 2);
  const phase = resolveStorySlicePhase(screenshotIndex, totalScreenshots);
  const phaseDrift = phase === 0 ? Math.round(width * 0.14) : phase === 1 ? 0 : -Math.round(width * 0.14);

  const screenshotLeft = clamp(
    baseLeft + phaseDrift,
    -Math.round(width * 0.2),
    width - screenshot.width + Math.round(width * 0.2),
  );
  const screenshotTop = screenshotAreaTop + Math.round((screenshotAreaHeight - screenshot.height) / 2);

  const textSvg = createTextSvg({
    width,
    height: textAreaHeight,
    headline,
    subtitle,
    template,
    align: phase === 1 ? 'center' : 'left',
    paddingX: Math.round(width * 0.09),
    headlineScale: width >= 1500 ? 0.05 : 0.054,
    subtitleScale: width >= 1500 ? 0.028 : 0.031,
    maxHeadlineLines: 2,
    maxSubtitleLines: 2,
    panelFill: getTextPanelFill(template.textColor),
    panelOpacity: 0.26,
    panelInset: Math.round(width * 0.03),
    panelRadius: Math.round(width * 0.026),
  });

  return [
    { input: screenshot.buffer, left: screenshotLeft, top: screenshotTop },
    { input: Buffer.from(textSvg), left: 0, top: 0 },
  ];
}

function resolveLayoutVariant(template: TemplateConfig, screenshotIndex: number): LayoutVariant {
  const cycle = TEMPLATE_LAYOUT_CYCLES[template.id] ?? DEFAULT_LAYOUT_CYCLE;
  return cycle[screenshotIndex % cycle.length] ?? 'hero-top';
}

function resolveScreenDrift(width: number, screenshotIndex: number, totalScreenshots: number): number {
  if (totalScreenshots <= 1) return 0;

  const phase = screenshotIndex % 3;
  if (phase === 0) return Math.round(width * 0.17);
  if (phase === 1) return 0;
  return -Math.round(width * 0.17);
}

function resolveStorySlicePhase(screenshotIndex: number, totalScreenshots: number): number {
  const groupSize = totalScreenshots >= 3 ? 3 : Math.min(2, totalScreenshots);
  if (groupSize <= 1) return 1;
  return screenshotIndex % groupSize;
}

async function prepareScreenshot(
  screenshotBuffer: Buffer,
  maxWidth: number,
  maxHeight: number,
  radius: number,
): Promise<PreparedScreenshot> {
  const safeMaxWidth = Math.max(64, Math.round(maxWidth));
  const safeMaxHeight = Math.max(64, Math.round(maxHeight));

  const { data, info } = await sharp(screenshotBuffer)
    .rotate()
    .resize(safeMaxWidth, safeMaxHeight, { fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true });

  const width = info.width ?? safeMaxWidth;
  const height = info.height ?? safeMaxHeight;

  const roundedBuffer = await addRoundedCorners(data, width, height, Math.max(12, Math.round(radius)));

  return {
    buffer: roundedBuffer,
    width,
    height,
  };
}

function createBackgroundSvg(width: number, height: number, bg: string | GradientConfig): string {
  if (typeof bg === 'string') {
    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bg}"/>
    </svg>`;
  }

  const gradientAxis = resolveGradientAxis(bg.angle);
  const stops = bg.stops.map((stop) => `<stop offset="${stop.position}%" stop-color="${stop.color}"/>`).join('');

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="${gradientAxis.x1}%" y1="${gradientAxis.y1}%" x2="${gradientAxis.x2}%" y2="${gradientAxis.y2}%">${stops}</linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
  </svg>`;
}

function createFlowOverlaySvg(
  width: number,
  height: number,
  template: TemplateConfig,
  screenshotIndex: number,
  totalScreenshots: number,
): string {
  const totalWidth = Math.max(width, width * totalScreenshots);
  const offsetX = screenshotIndex * width;

  const path1StartX = totalWidth * 0.06 - offsetX;
  const path1MidX1 = totalWidth * 0.34 - offsetX;
  const path1MidX2 = totalWidth * 0.62 - offsetX;
  const path1EndX = totalWidth * 0.94 - offsetX;

  const path2StartX = totalWidth * 0.12 - offsetX;
  const path2MidX1 = totalWidth * 0.38 - offsetX;
  const path2MidX2 = totalWidth * 0.66 - offsetX;
  const path2EndX = totalWidth * 0.92 - offsetX;

  const strokeColor = normalizeStrokeColor(template.subtitleColor, 0.26);
  const glowColor = normalizeStrokeColor(template.textColor, 0.16);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="flowA" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0"/>
        <stop offset="50%" stop-color="${strokeColor}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="flowB" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${glowColor}" stop-opacity="0"/>
        <stop offset="50%" stop-color="${glowColor}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${glowColor}" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <path d="M ${path1StartX} ${height * 0.8} C ${path1MidX1} ${height * 0.72}, ${path1MidX2} ${height * 0.32}, ${path1EndX} ${height * 0.2}"
      stroke="url(#flowA)" stroke-width="${Math.max(3, Math.round(width * 0.006))}" fill="none"/>

    <path d="M ${path2StartX} ${height * 0.14} C ${path2MidX1} ${height * 0.24}, ${path2MidX2} ${height * 0.64}, ${path2EndX} ${height * 0.7}"
      stroke="url(#flowB)" stroke-width="${Math.max(2, Math.round(width * 0.0038))}" fill="none"/>

    <circle cx="${totalWidth * 0.24 - offsetX}" cy="${height * 0.74}" r="${Math.round(width * 0.07)}" fill="${glowColor}" fill-opacity="0.18"/>
    <circle cx="${totalWidth * 0.78 - offsetX}" cy="${height * 0.22}" r="${Math.round(width * 0.06)}" fill="${strokeColor}" fill-opacity="0.16"/>
  </svg>`;
}

function createStorySliceOverlaySvg(
  width: number,
  height: number,
  template: TemplateConfig,
  screenshotIndex: number,
  totalScreenshots: number,
): string {
  const groupSize = totalScreenshots >= 3 ? 3 : Math.min(2, totalScreenshots);
  const virtualWidth = Math.max(width, width * Math.max(1, groupSize));
  const indexInGroup = groupSize <= 1 ? 0 : screenshotIndex % groupSize;
  const offsetX = indexInGroup * width;

  const fillPrimary = normalizeStrokeColor(template.textColor, 0.24);
  const fillSecondary = normalizeStrokeColor(template.subtitleColor, 0.2);
  const strokeColor = normalizeStrokeColor(template.subtitleColor, 0.42);

  const pathStartX = virtualWidth * 0.04 - offsetX;
  const pathPeakX = virtualWidth * 0.56 - offsetX;
  const pathEndX = virtualWidth * 0.98 - offsetX;

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="storyBand" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${fillPrimary}"/>
        <stop offset="50%" stop-color="${fillSecondary}"/>
        <stop offset="100%" stop-color="${fillPrimary}"/>
      </linearGradient>
    </defs>

    <path d="M ${pathStartX} ${height * 0.84} C ${virtualWidth * 0.24 - offsetX} ${height * 0.64}, ${pathPeakX} ${height * 0.18}, ${pathEndX} ${height * 0.34}
      L ${pathEndX} ${height * 0.56} C ${virtualWidth * 0.62 - offsetX} ${height * 0.88}, ${virtualWidth * 0.34 - offsetX} ${height * 0.92}, ${pathStartX} ${height * 0.72} Z"
      fill="url(#storyBand)" fill-opacity="0.88" stroke="${strokeColor}" stroke-width="${Math.max(2, Math.round(width * 0.0025))}"/>

    <text x="${virtualWidth * 0.48 - offsetX}" y="${height * 0.58}" text-anchor="middle"
      font-family="${escapeXml(template.fontFamily)}, sans-serif" font-size="${Math.max(30, Math.round(width * 0.08))}" letter-spacing="${Math.round(width * 0.008)}"
      fill="${normalizeStrokeColor(template.textColor, 0.22)}">STORY ARC</text>
  </svg>`;
}

function createTextSvg(options: TextSvgOptions): string {
  const {
    width,
    height,
    headline,
    subtitle,
    template,
    align = 'center',
    paddingX = Math.round(width * 0.08),
    headlineScale = 0.055,
    subtitleScale = 0.031,
    maxHeadlineLines = 2,
    maxSubtitleLines = 2,
    panelFill,
    panelOpacity = 0.3,
    panelInset = 0,
    panelRadius = Math.round(width * 0.02),
  } = options;

  const isChineseText = /[一-鿿]/.test(`${headline} ${subtitle}`);
  const fontFamily = isChineseText ? `${template.fontFamilyZh}, sans-serif` : `${template.fontFamily}, sans-serif`;
  const headlineSize = Math.round(width * headlineScale);
  const subtitleSize = Math.round(width * subtitleScale);

  const maxHeadlineChars = calcMaxChars(width, paddingX, headlineSize, isChineseText);
  const maxSubtitleChars = calcMaxChars(width, paddingX, subtitleSize, isChineseText);

  const headlineLines = wrapText(headline, maxHeadlineChars, maxHeadlineLines, isChineseText);
  const subtitleLines = wrapText(subtitle, maxSubtitleChars, maxSubtitleLines, isChineseText);

  const titleLineHeight = Math.round(headlineSize * 1.2);
  const subtitleLineHeight = Math.round(subtitleSize * 1.35);
  const spacingBetweenGroups = subtitleLines.length > 0 && headlineLines.length > 0 ? Math.round(subtitleSize * 0.6) : 0;

  const textBlockHeight =
    headlineLines.length * titleLineHeight +
    spacingBetweenGroups +
    subtitleLines.length * subtitleLineHeight;

  const startY = Math.round((height - textBlockHeight) / 2) + headlineSize;
  const textAnchor = align === 'center' ? 'middle' : 'start';
  const x = align === 'center' ? Math.round(width / 2) : paddingX;

  const headlineElements = headlineLines
    .map(
      (line, index) => `<text x="${x}" y="${startY + index * titleLineHeight}" text-anchor="${textAnchor}"
      font-family="${escapeXml(fontFamily)}" font-size="${headlineSize}" font-weight="700" fill="${template.textColor}">
      ${escapeXml(line)}
    </text>`,
    )
    .join('');

  const subtitleStartY = startY + headlineLines.length * titleLineHeight + spacingBetweenGroups;

  const subtitleElements = subtitleLines
    .map(
      (line, index) => `<text x="${x}" y="${subtitleStartY + subtitleSize + index * subtitleLineHeight}" text-anchor="${textAnchor}"
      font-family="${escapeXml(fontFamily)}" font-size="${subtitleSize}" font-weight="450" fill="${template.subtitleColor}">
      ${escapeXml(line)}
    </text>`,
    )
    .join('');

  const panelRect = panelFill
    ? `<rect x="${panelInset}" y="${panelInset}" width="${width - panelInset * 2}" height="${height - panelInset * 2}" rx="${panelRadius}" fill="${panelFill}" fill-opacity="${panelOpacity}"/>`
    : '';

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${panelRect}
    ${headlineElements}
    ${subtitleElements}
  </svg>`;
}

function createWatermarkSvg(width: number, height: number, watermarkText: string): string {
  const fontSize = Math.max(20, Math.round(Math.min(width, height) * 0.024));
  const inset = Math.max(22, Math.round(width * 0.024));
  const badgeHeight = Math.round(fontSize * 1.7);
  const horizontalPadding = Math.round(fontSize * 0.72);
  const textWidthEstimate = Math.round(watermarkText.length * fontSize * 0.62);
  const badgeWidth = textWidthEstimate + horizontalPadding * 2;
  const badgeX = Math.max(inset, width - inset - badgeWidth);
  const badgeY = Math.max(inset, height - inset - badgeHeight);
  const textX = badgeX + badgeWidth / 2;
  const textY = badgeY + badgeHeight / 2 + Math.round(fontSize * 0.34);

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <g>
      <rect x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="${Math.round(badgeHeight / 2)}"
        fill="#020617" fill-opacity="0.58"/>
      <text x="${textX}" y="${textY}" text-anchor="middle"
        font-family="sans-serif" font-size="${fontSize}"
        font-weight="700" fill="#FFFFFF" fill-opacity="0.9">
        ${escapeXml(watermarkText)}
      </text>
    </g>
  </svg>`;
}

async function addRoundedCorners(buffer: Buffer, width: number, height: number, radius: number): Promise<Buffer> {
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`,
  );

  return sharp(buffer)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function resolveGradientAxis(angle: number): { x1: string; y1: string; x2: string; y2: string } {
  const normalizedAngle = Number.isFinite(angle) ? angle : 180;
  const radians = ((normalizedAngle - 90) * Math.PI) / 180;
  const x = Math.cos(radians);
  const y = Math.sin(radians);

  return {
    x1: (50 - x * 50).toFixed(2),
    y1: (50 - y * 50).toFixed(2),
    x2: (50 + x * 50).toFixed(2),
    y2: (50 + y * 50).toFixed(2),
  };
}

function normalizeStrokeColor(color: string, opacity: number): string {
  const parsed = parseRgb(color);
  if (!parsed) {
    return `rgba(255,255,255,${opacity})`;
  }

  return `rgba(${parsed.r},${parsed.g},${parsed.b},${opacity})`;
}

function getTextPanelFill(textColor: string): string {
  const luma = getColorLuma(textColor);
  if (luma === null) return 'rgba(15,23,42,0.8)';
  return luma > 180 ? 'rgba(15,23,42,0.88)' : 'rgba(248,250,252,0.88)';
}

function getColorLuma(color: string): number | null {
  const rgb = parseRgb(color);
  if (!rgb) return null;
  return rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
}

function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim();

  const shortHex = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (shortHex) {
    const expanded = shortHex[1]
      .split('')
      .map((ch) => ch + ch)
      .join('');
    return parseRgb(`#${expanded}`);
  }

  const hex = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (hex) {
    const value = hex[1];
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(trimmed);
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
    };
  }

  return null;
}

function calcMaxChars(width: number, paddingX: number, fontSize: number, isChinese: boolean): number {
  const drawableWidth = Math.max(120, width - paddingX * 2);
  const charWidthRatio = isChinese ? 1 : 0.56;
  return Math.max(6, Math.floor(drawableWidth / (fontSize * charWidthRatio)));
}

function wrapText(text: string, maxChars: number, maxLines: number, isChinese: boolean): string[] {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) return [];

  if (isChinese) {
    return wrapCjkText(normalized, maxChars, maxLines);
  }

  return wrapLatinText(normalized, maxChars, maxLines);
}

function wrapCjkText(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cursor = 0;

  while (cursor < text.length && lines.length < maxLines) {
    lines.push(text.slice(cursor, cursor + maxChars));
    cursor += maxChars;
  }

  if (cursor < text.length && lines.length > 0) {
    lines[lines.length - 1] = withEllipsis(lines[lines.length - 1], maxChars);
  }

  return lines;
}

function wrapLatinText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxChars));
      current = word.length > maxChars ? word.slice(maxChars) : '';
    }

    if (lines.length === maxLines) {
      return lines.map((line, index) => (index === maxLines - 1 ? withEllipsis(line, maxChars) : line));
    }
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    return lines
      .slice(0, maxLines)
      .map((line, index) => (index === maxLines - 1 ? withEllipsis(line, maxChars) : line));
  }

  return lines;
}

function withEllipsis(line: string, maxChars: number): string {
  return `${line.slice(0, Math.max(1, maxChars - 1))}...`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
