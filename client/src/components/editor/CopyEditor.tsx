import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_EXPORT_LANGUAGES,
  dedupeLanguageCodes,
  getLanguageLabel,
  normalizeLanguageCode,
} from '@appshots/shared';
import type { GeneratedCopy } from '@appshots/shared';

interface CopyEditorProps {
  copy: GeneratedCopy;
  screenshotCount: number;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onCopyChange: (copy: GeneratedCopy) => void;
}

const WORD_BASED_LANGS = new Set(['en', 'pt', 'es', 'fr', 'de', 'it', 'id']);

export function CopyEditor({ copy, screenshotCount, currentIndex, onIndexChange, onCopyChange }: CopyEditorProps) {
  const [lang, setLang] = useState<string>('zh');
  const [customLanguage, setCustomLanguage] = useState('');
  const hasScreenshots = screenshotCount > 0;
  const headlines = copy.headlines ?? [];
  const subtitles = copy.subtitles ?? [];

  const availableLanguages = useMemo(() => {
    const collected: string[] = [...DEFAULT_EXPORT_LANGUAGES];
    for (const item of [...headlines, ...subtitles]) {
      Object.keys(item).forEach((key) => {
        if (key !== 'screenshotIndex') {
          collected.push(key);
        }
      });
    }
    return dedupeLanguageCodes(collected);
  }, [headlines, subtitles]);

  useEffect(() => {
    if (!availableLanguages.includes(lang)) {
      setLang(availableLanguages[0] ?? 'zh');
    }
  }, [availableLanguages, lang]);

  useEffect(() => {
    if (!hasScreenshots) return;
    if (currentIndex >= screenshotCount) {
      onIndexChange(Math.max(0, screenshotCount - 1));
    }
  }, [currentIndex, hasScreenshots, onIndexChange, screenshotCount]);

  const isWordBased = WORD_BASED_LANGS.has(normalizeLanguageCode(lang).split('-')[0]);
  const headlineRange: [number, number] = isWordBased ? [2, 6] : [6, 14];
  const subtitleRange: [number, number] = isWordBased ? [5, 12] : [12, 24];
  const lengthUnit = isWordBased ? '词' : '字';

  const countTextUnits = (value: string) => {
    if (!value.trim()) return 0;
    if (isWordBased) {
      return value.trim().split(/\s+/).filter(Boolean).length;
    }
    return value.replace(/\s+/g, '').length;
  };

  const getLengthMeta = (value: string, type: 'headline' | 'subtitle') => {
    const [min, max] = type === 'headline' ? headlineRange : subtitleRange;
    const count = countTextUnits(value);
    if (count === 0) {
      return {
        label: '待填写',
        tone: 'bg-white/5 text-slate-300 ring-1 ring-white/10',
        message: `推荐 ${min}-${max} ${lengthUnit}`,
      };
    }
    if (count < min) {
      return {
        label: '偏短',
        tone: 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/40',
        message: `${count} ${lengthUnit} / 推荐 ${min}-${max} ${lengthUnit}`,
      };
    }
    if (count > max) {
      return {
        label: '偏长',
        tone: 'bg-rose-500/15 text-rose-100 ring-1 ring-rose-300/40',
        message: `${count} ${lengthUnit} / 推荐 ${min}-${max} ${lengthUnit}`,
      };
    }
    return {
      label: '刚好',
      tone: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/40',
      message: `${count} ${lengthUnit} / 推荐 ${min}-${max} ${lengthUnit}`,
    };
  };

  const ensureEntry = (entries: GeneratedCopy['headlines'], index: number) => {
    const next = [...entries];
    while (next.length <= index) {
      next.push({ screenshotIndex: next.length });
    }
    return next;
  };

  const safeIndex = hasScreenshots ? Math.min(currentIndex, screenshotCount - 1) : 0;

  const getEntryValue = (entries: GeneratedCopy['headlines'], index: number, code: string): string => {
    const entry = entries.find((item) => item.screenshotIndex === index) ?? entries[index];
    if (!entry) return '';
    const value = entry[code];
    return typeof value === 'string' ? value : '';
  };

  const updateHeadline = (value: string) => {
    const nextHeadlines = ensureEntry(headlines, safeIndex);
    nextHeadlines[safeIndex] = { ...nextHeadlines[safeIndex], screenshotIndex: safeIndex, [lang]: value };
    onCopyChange({ ...copy, headlines: nextHeadlines });
  };

  const updateSubtitle = (value: string) => {
    const nextSubtitles = ensureEntry(subtitles, safeIndex);
    nextSubtitles[safeIndex] = { ...nextSubtitles[safeIndex], screenshotIndex: safeIndex, [lang]: value };
    onCopyChange({ ...copy, subtitles: nextSubtitles });
  };

  const addLanguage = () => {
    const nextCode = normalizeLanguageCode(customLanguage);
    if (!nextCode) return;
    if (availableLanguages.includes(nextCode)) {
      setLang(nextCode);
      setCustomLanguage('');
      return;
    }

    const nextHeadlines = Array.from({ length: Math.max(headlines.length, screenshotCount) }, (_, index) => {
      const existing = headlines.find((item) => item.screenshotIndex === index) ?? headlines[index] ?? { screenshotIndex: index };
      return { ...existing, screenshotIndex: index, [nextCode]: typeof existing[nextCode] === 'string' ? existing[nextCode] : '' };
    });

    const nextSubtitles = Array.from({ length: Math.max(subtitles.length, screenshotCount) }, (_, index) => {
      const existing = subtitles.find((item) => item.screenshotIndex === index) ?? subtitles[index] ?? { screenshotIndex: index };
      return { ...existing, screenshotIndex: index, [nextCode]: typeof existing[nextCode] === 'string' ? existing[nextCode] : '' };
    });

    const nextTagline = { ...(copy.tagline || {}), [nextCode]: copy.tagline?.[nextCode] ?? '' };

    onCopyChange({
      ...copy,
      headlines: nextHeadlines,
      subtitles: nextSubtitles,
      tagline: nextTagline,
    });

    setLang(nextCode);
    setCustomLanguage('');
  };

  const headline = getEntryValue(headlines, safeIndex, lang);
  const subtitle = getEntryValue(subtitles, safeIndex, lang);
  const headlineMeta = getLengthMeta(headline, 'headline');
  const subtitleMeta = getLengthMeta(subtitle, 'subtitle');
  const headlineFilled = headline.trim().length > 0;
  const subtitleFilled = subtitle.trim().length > 0;
  const completion =
    headlineFilled && subtitleFilled ? '已完成' : headlineFilled || subtitleFilled ? '部分完成' : '待填写';
  const completionTone =
    completion === '已完成'
      ? 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/40'
      : completion === '部分完成'
        ? 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/40'
        : 'bg-white/5 text-slate-300 ring-1 ring-white/10';
  const canGoPrev = hasScreenshots && currentIndex > 0;
  const canGoNext = hasScreenshots && currentIndex < screenshotCount - 1;
  const findNextIncomplete = (direction: 1 | -1) => {
    if (!hasScreenshots) return null;
    const start = currentIndex + direction;
    if (start < 0 || start >= screenshotCount) return null;
    for (let i = start; i >= 0 && i < screenshotCount; i += direction) {
      const headlineValue = getEntryValue(headlines, i, lang).trim();
      const subtitleValue = getEntryValue(subtitles, i, lang).trim();
      if (!headlineValue || !subtitleValue) return i;
    }
    return null;
  };
  const nextIncomplete = findNextIncomplete(1);
  const prevIncomplete = findNextIncomplete(-1);

  return (
    <div className="sf-card-soft space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            截图 {hasScreenshots ? currentIndex + 1 : 0}/{screenshotCount} 文案
          </h3>
          <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">Live Copy</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${completionTone}`}>{completion}</span>
          <div className="flex flex-wrap gap-1 text-xs">
            {availableLanguages.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`rounded-lg px-2.5 py-1.5 ${
                  lang === code ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-300 ring-1 ring-white/10'
                }`}
              >
                {getLanguageLabel(code)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={customLanguage}
          onChange={(event) => setCustomLanguage(event.target.value)}
          placeholder="添加语言代码，例如：es / fr / de"
          className="sf-input max-w-[260px]"
        />
        <button type="button" onClick={addLanguage} className="sf-btn-ghost px-3 py-1.5 text-xs">
          添加语言
        </button>
      </div>

      <p className="text-xs text-slate-400">更改会自动同步到项目，可随时在右侧预览。</p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
          快速导航
        </span>
        <button
          type="button"
          onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
          disabled={!canGoPrev}
          className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          上一张
        </button>
        <button
          type="button"
          onClick={() => onIndexChange(Math.min(screenshotCount - 1, currentIndex + 1))}
          disabled={!canGoNext}
          className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一张
        </button>
        <button
          type="button"
          onClick={() => {
            if (prevIncomplete !== null) onIndexChange(prevIncomplete);
          }}
          disabled={prevIncomplete === null}
          className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100 transition hover:border-amber-200/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          上一条未完成
        </button>
        <button
          type="button"
          onClick={() => {
            if (nextIncomplete !== null) onIndexChange(nextIncomplete);
          }}
          disabled={nextIncomplete === null}
          className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-100 transition hover:border-amber-200/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一条未完成
        </button>
      </div>

      {!hasScreenshots && (
        <div className="rounded-lg border border-dashed border-white/15 bg-white/5 px-4 py-6 text-center text-sm text-slate-300">
          上传截图后即可编辑对应的标题与副标题。
        </div>
      )}

      <div>
        <label className="sf-label">标题（{getLanguageLabel(lang)} 建议 {headlineRange[0]}-{headlineRange[1]} {lengthUnit}）</label>
        <input
          type="text"
          value={headline}
          onChange={(e) => updateHeadline(e.target.value)}
          className="sf-input"
          disabled={!hasScreenshots}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${headlineMeta.tone}`}>{headlineMeta.label}</span>
          <span>{headlineMeta.message}</span>
        </div>
      </div>

      <div>
        <label className="sf-label">副标题（{getLanguageLabel(lang)} 建议 {subtitleRange[0]}-{subtitleRange[1]} {lengthUnit}）</label>
        <input
          type="text"
          value={subtitle}
          onChange={(e) => updateSubtitle(e.target.value)}
          className="sf-input"
          disabled={!hasScreenshots}
        />
        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${subtitleMeta.tone}`}>{subtitleMeta.label}</span>
          <span>{subtitleMeta.message}</span>
        </div>
      </div>
    </div>
  );
}
