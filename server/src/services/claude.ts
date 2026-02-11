import { env } from '../config/env.js';
import { DEFAULT_EXPORT_LANGUAGES, DEFAULT_LANGUAGE_LABELS, TEMPLATES, dedupeLanguageCodes } from '@appshots/shared';
import type {
  AIAnalysis,
  CopyVariant,
  CompositionModeId,
  GeneratedCopy,
  TemplateComboItem,
  TemplateStyleId,
} from '@appshots/shared';

const model = env.openaiModel;
const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateStyleId[];
const COMPOSITION_MODES: CompositionModeId[] = ['flow-drift', 'story-slice'];

type ChatRole = 'system' | 'user' | 'assistant';
type TextPart = { type: 'text'; text: string };
type ImagePart = {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
};
type ChatContentPart = TextPart | ImagePart;

interface ChatMessage {
  role: ChatRole;
  content: string | ChatContentPart[];
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .join('');
}

function parseStreamedContent(raw: string): string {
  let content = '';

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      const chunk = JSON.parse(payload) as {
        choices?: Array<{
          delta?: { content?: unknown };
          message?: { content?: unknown };
        }>;
      };

      for (const choice of chunk.choices || []) {
        content += extractTextContent(choice.delta?.content ?? choice.message?.content);
      }
    } catch {
      // Ignore malformed chunks and continue reading the rest.
    }
  }

  return content.trim();
}

function parseRegularContent(raw: string): string {
  try {
    const payload = JSON.parse(raw) as {
      choices?: Array<{
        message?: { content?: unknown };
        delta?: { content?: unknown };
      }>;
    };

    const firstChoice = payload.choices?.[0];
    return extractTextContent(firstChoice?.message?.content ?? firstChoice?.delta?.content).trim();
  } catch {
    return '';
  }
}

async function createChatCompletion(messages: ChatMessage[], maxTokens: number): Promise<string> {
  if (!env.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch(`${normalizeBaseUrl(env.openaiBaseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`LLM request failed (${response.status}): ${raw.slice(0, 500)}`);
  }

  return parseStreamedContent(raw) || parseRegularContent(raw);
}

function isTemplateStyleId(value: unknown): value is TemplateStyleId {
  return typeof value === 'string' && value in TEMPLATES;
}

function isCompositionModeId(value: unknown): value is CompositionModeId {
  return typeof value === 'string' && COMPOSITION_MODES.includes(value as CompositionModeId);
}

function sanitizeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);
}

function coerceTemplateComboItem(item: unknown): TemplateComboItem | null {
  if (!item || typeof item !== 'object') return null;

  const raw = item as Partial<TemplateComboItem>;
  if (!isTemplateStyleId(raw.template)) return null;

  const compositionMode = isCompositionModeId(raw.compositionMode)
    ? raw.compositionMode
    : TEMPLATES[raw.template].compositionMode;
  const reason = typeof raw.reason === 'string' && raw.reason.trim().length > 0 ? raw.reason.trim() : 'Matches app tone';

  return {
    template: raw.template,
    compositionMode,
    reason,
  };
}

function buildFallbackTemplateCombo(primaryTemplate: TemplateStyleId): TemplateComboItem[] {
  const primaryMode = TEMPLATES[primaryTemplate].compositionMode;

  const sameModeTemplates = TEMPLATE_IDS.filter(
    (templateId) => templateId !== primaryTemplate && TEMPLATES[templateId].compositionMode === primaryMode,
  );
  const crossModeTemplates = TEMPLATE_IDS.filter((templateId) => TEMPLATES[templateId].compositionMode !== primaryMode);

  const comboTemplates = [primaryTemplate, ...sameModeTemplates.slice(0, 1), ...crossModeTemplates.slice(0, 1)].slice(0, 3);

  return comboTemplates.map((templateId, index) => ({
    template: templateId,
    compositionMode: TEMPLATES[templateId].compositionMode,
    reason: index === 0 ? 'Primary match for app identity' : 'Complementary visual direction for narrative sequencing',
  }));
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.78;
  return Math.min(1, Math.max(0, value));
}

function normalizeAIAnalysis(raw: unknown): AIAnalysis {
  const rawAnalysis = (raw && typeof raw === 'object' ? raw : {}) as Partial<AIAnalysis>;

  const recommendedTemplate = isTemplateStyleId(rawAnalysis.recommendedTemplate)
    ? rawAnalysis.recommendedTemplate
    : 'clean';

  const recommendedCompositionMode = isCompositionModeId(rawAnalysis.recommendedCompositionMode)
    ? rawAnalysis.recommendedCompositionMode
    : TEMPLATES[recommendedTemplate].compositionMode;

  const candidateCombo = Array.isArray(rawAnalysis.recommendedTemplateCombo)
    ? rawAnalysis.recommendedTemplateCombo.map(coerceTemplateComboItem).filter((item): item is TemplateComboItem => item !== null)
    : [];

  const combo: TemplateComboItem[] = [];
  const usedTemplates = new Set<TemplateStyleId>();

  const ensurePrimary = {
    template: recommendedTemplate,
    compositionMode: recommendedCompositionMode,
    reason: 'Primary match for app identity',
  };

  combo.push(ensurePrimary);
  usedTemplates.add(ensurePrimary.template);

  for (const item of candidateCombo) {
    if (combo.length >= 3) break;
    if (usedTemplates.has(item.template)) continue;
    combo.push(item);
    usedTemplates.add(item.template);
  }

  if (combo.length < 3) {
    const fallback = buildFallbackTemplateCombo(recommendedTemplate);
    for (const item of fallback) {
      if (combo.length >= 3) break;
      if (usedTemplates.has(item.template)) continue;
      combo.push(item);
      usedTemplates.add(item.template);
    }
  }

  return {
    appType: typeof rawAnalysis.appType === 'string' && rawAnalysis.appType.trim().length > 0 ? rawAnalysis.appType.trim() : 'utility',
    keyFeatures: sanitizeStringArray(rawAnalysis.keyFeatures, 8),
    colorPalette: sanitizeStringArray(rawAnalysis.colorPalette, 8),
    recommendedTemplate,
    recommendedCompositionMode,
    recommendedTemplateCombo: combo,
    confidence: normalizeConfidence(rawAnalysis.confidence),
  };
}

function getTemplatePromptCatalog(): string {
  return TEMPLATE_IDS.map((templateId) => {
    const mode = TEMPLATES[templateId].compositionMode;
    return `- "${templateId}" (mode: ${mode})`;
  }).join('\n');
}

function normalizeCopyVariant(
  raw: unknown,
  screenshotIndex: number,
  languages: readonly string[],
): CopyVariant {
  const base: CopyVariant = { screenshotIndex };
  if (!raw || typeof raw !== 'object') {
    languages.forEach((code) => {
      base[code] = '';
    });
    return base;
  }

  const source = raw as Record<string, unknown>;
  for (const [key, value] of Object.entries(source)) {
    if (key === 'screenshotIndex') continue;
    if (typeof value === 'string') {
      base[key] = value;
    }
  }

  const fallbackText = pickFallbackText(base, languages);
  languages.forEach((code) => {
    const value = base[code];
    if (typeof value === 'string' && value.trim().length > 0) return;
    base[code] = fallbackText;
  });

  return base;
}

function pickFallbackText(source: Record<string, string | number>, languages: readonly string[]): string {
  const priority = dedupeLanguageCodes(['en', 'zh', ...languages], languages);
  for (const code of priority) {
    const value = source[code];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  for (const [key, value] of Object.entries(source)) {
    if (key === 'screenshotIndex') continue;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

function normalizeTagline(rawTagline: Record<string, unknown>, languages: readonly string[]): Record<string, string> {
  const tagLineFallback = pickFallbackText(rawTagline as Record<string, string | number>, languages);
  const tagline: Record<string, string> = {};

  languages.forEach((code) => {
    const value = rawTagline[code];
    tagline[code] = typeof value === 'string' && value.trim().length > 0 ? value.trim() : tagLineFallback;
  });

  return tagline;
}

function normalizeGeneratedCopy(raw: unknown, screenshotCount: number, languages: readonly string[]): GeneratedCopy {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<GeneratedCopy> & Record<string, unknown>;
  const targetLanguages = dedupeLanguageCodes(languages, DEFAULT_EXPORT_LANGUAGES);
  const headlineSource = Array.isArray(source.headlines) ? source.headlines : [];
  const subtitleSource = Array.isArray(source.subtitles) ? source.subtitles : [];

  const headlines = Array.from({ length: screenshotCount }, (_, index) => {
    const matched = headlineSource.find((item) => {
      if (!item || typeof item !== 'object') return false;
      return (item as { screenshotIndex?: unknown }).screenshotIndex === index;
    });
    return normalizeCopyVariant(matched ?? headlineSource[index], index, targetLanguages);
  });

  const subtitles = Array.from({ length: screenshotCount }, (_, index) => {
    const matched = subtitleSource.find((item) => {
      if (!item || typeof item !== 'object') return false;
      return (item as { screenshotIndex?: unknown }).screenshotIndex === index;
    });
    return normalizeCopyVariant(matched ?? subtitleSource[index], index, targetLanguages);
  });

  const rawTagline = source.tagline && typeof source.tagline === 'object' ? (source.tagline as Record<string, unknown>) : {};
  const tagline = normalizeTagline(rawTagline, targetLanguages);

  return { headlines, subtitles, tagline };
}

function buildLanguagePrompt(languages: readonly string[]): string {
  return languages
    .map((code) => `- "${code}" (${DEFAULT_LANGUAGE_LABELS[code] ?? code.toUpperCase()})`)
    .join('\n');
}

function buildLanguageObjectExample(languages: readonly string[], zhText: string, enText: string): string {
  return languages
    .map((code) => {
      if (code === 'zh') return `"zh": "${zhText}"`;
      if (code === 'en') return `"en": "${enText}"`;
      return `"${code}": "${enText} (${code})"`;
    })
    .join(', ');
}

export async function analyzeScreenshots(
  screenshotBuffers: Buffer[],
  appName: string,
  appDescription?: string,
): Promise<AIAnalysis> {
  const imageMessages: ChatContentPart[] = screenshotBuffers.flatMap((buf, i) => [
    { type: 'text', text: `Screenshot ${i + 1}:` },
    {
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${buf.toString('base64')}`,
        detail: 'high',
      },
    },
  ]);

  const text = await createChatCompletion(
    [
      {
        role: 'user',
        content: [
          ...imageMessages,
          {
            type: 'text',
            text: `You are analyzing screenshots of a mobile app called "${appName}".
${appDescription ? `Description: ${appDescription}` : ''}

Return a JSON object with this exact schema:
{
  "appType": "category of app (e.g., social media, fitness, finance, productivity, tool, game)",
  "keyFeatures": ["feature1", "feature2", "feature3"],
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "recommendedTemplate": one of the template ids listed below,
  "recommendedCompositionMode": "flow-drift" | "story-slice",
  "recommendedTemplateCombo": [
    {
      "template": template id,
      "compositionMode": "flow-drift" | "story-slice",
      "reason": "short reason"
    }
  ],
  "confidence": 0.0-1.0
}

Composition modes:
- "flow-drift": coherent directional flow + primary screenshot edge drift. Each output image still has one single screenshot subject.
- "story-slice": strict hero visual slicing across 2-3 neighboring screenshots while each screenshot remains the single subject.

Template ids:
${getTemplatePromptCatalog()}

Rules:
1) recommendedTemplateCombo must contain exactly 3 items.
2) Item #1 in recommendedTemplateCombo must match recommendedTemplate.
3) compositionMode in each combo item must match the template's mode shown in the catalog.
4) Return only JSON, no markdown, no comments.
`,
          },
        ],
      },
    ],
    2400,
  );

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse AI analysis response');

  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse AI analysis JSON');
  }

  return normalizeAIAnalysis(raw);
}

export async function generateCopy(
  analysis: AIAnalysis,
  appName: string,
  screenshotCount: number,
  appDescription?: string,
  languages: readonly string[] = DEFAULT_EXPORT_LANGUAGES,
): Promise<GeneratedCopy> {
  const requestedLanguages = dedupeLanguageCodes(languages, DEFAULT_EXPORT_LANGUAGES);
  const languageCatalog = buildLanguagePrompt(requestedLanguages);
  const headlineExample = buildLanguageObjectExample(requestedLanguages, '中文标题', 'English headline');
  const subtitleExample = buildLanguageObjectExample(requestedLanguages, '中文副标题', 'English subtitle');
  const taglineExample = buildLanguageObjectExample(requestedLanguages, '应用标语', 'App tagline');

  const text = await createChatCompletion(
    [
      {
        role: 'system',
        content: `You are a professional App Store marketing copywriter.
Write compelling, concise copy for App Store and Google Play screenshots.
Always provide every requested language key.
Chinese copy should feel natural and idiomatic, not a direct translation.
Keep all language variants aligned in meaning, tone, and structure.`,
      },
      {
        role: 'user',
        content: `App: "${appName}"
${appDescription ? `Description: ${appDescription}` : ''}
App Type: ${analysis.appType}
Key Features: ${analysis.keyFeatures.join(', ')}
Number of screenshots: ${screenshotCount}
Requested languages:
${languageCatalog}

Generate marketing copy for app store screenshots. Return JSON:
{
  "headlines": [
    { "screenshotIndex": 0, ${headlineExample} },
    ...one per screenshot
  ],
  "subtitles": [
    { "screenshotIndex": 0, ${subtitleExample} },
    ...one per screenshot
  ],
  "tagline": { ${taglineExample} }
}

Headlines: 2-6 words, impactful, action-oriented.
Subtitles: 5-12 words, explain the benefit.
Make each screenshot's copy highlight a different feature.
Each headline/subtitle object MUST contain every requested language key.
tagline MUST contain every requested language key.
Return ONLY the JSON object.`,
      },
    ],
    4096,
  );

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse copy generation response');

  let raw: unknown;
  try {
    raw = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse copy generation JSON');
  }

  return normalizeGeneratedCopy(raw, screenshotCount, requestedLanguages);
}
