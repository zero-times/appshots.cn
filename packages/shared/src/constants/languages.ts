export type LanguageCode = string;

export const DEFAULT_EXPORT_LANGUAGES = ['zh', 'en', 'pt', 'ja', 'ko'] as const;

export const DEFAULT_LANGUAGE_LABELS: Record<string, string> = {
  zh: '中文',
  en: 'English',
  pt: 'Português',
  ja: '日本語',
  ko: '한국어',
};

export function normalizeLanguageCode(input: string): string {
  return input.trim().toLowerCase().replace(/_/g, '-');
}

export function dedupeLanguageCodes(
  input: readonly string[] | undefined,
  fallback: readonly string[] = DEFAULT_EXPORT_LANGUAGES,
): string[] {
  const source = input && input.length > 0 ? input : fallback;
  const set = new Set<string>();
  for (const raw of source) {
    const code = normalizeLanguageCode(raw);
    if (code) set.add(code);
  }
  return set.size > 0 ? [...set] : [...fallback];
}

export function getLanguageLabel(code: string): string {
  const normalized = normalizeLanguageCode(code);
  return DEFAULT_LANGUAGE_LABELS[normalized] ?? normalized.toUpperCase();
}
