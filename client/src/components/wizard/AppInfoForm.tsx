import { useMemo, useState } from 'react';
import {
  DEFAULT_EXPORT_LANGUAGES,
  dedupeLanguageCodes,
  getLanguageLabel,
  normalizeLanguageCode,
} from '@appshots/shared';

interface AppInfoFormProps {
  appName: string;
  appDescription: string;
  supportedLanguages: string[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSupportedLanguagesChange: (value: string[]) => void;
  onSubmit: () => void;
  isLoading: boolean;
  error?: string | null;
  languageSelectionLocked?: boolean;
  languageLockHint?: string;
}

export function AppInfoForm({
  appName,
  appDescription,
  supportedLanguages,
  onNameChange,
  onDescriptionChange,
  onSupportedLanguagesChange,
  onSubmit,
  isLoading,
  error,
  languageSelectionLocked = false,
  languageLockHint,
}: AppInfoFormProps) {
  const [customLanguage, setCustomLanguage] = useState('');
  const nameCount = appName.trim().length;
  const descriptionCount = appDescription.trim().length;

  const languageOptions = useMemo(
    () => dedupeLanguageCodes([...DEFAULT_EXPORT_LANGUAGES, ...supportedLanguages]),
    [supportedLanguages],
  );

  const toggleLanguage = (code: string) => {
    if (languageSelectionLocked) return;
    const normalized = normalizeLanguageCode(code);
    const exists = supportedLanguages.includes(normalized);
    if (exists) {
      const next = supportedLanguages.filter((item) => item !== normalized);
      if (next.length === 0) return;
      onSupportedLanguagesChange(next);
      return;
    }
    onSupportedLanguagesChange(dedupeLanguageCodes([...supportedLanguages, normalized], supportedLanguages));
  };

  const addCustomLanguage = () => {
    if (languageSelectionLocked) return;
    const normalized = normalizeLanguageCode(customLanguage);
    if (!normalized) return;
    onSupportedLanguagesChange(dedupeLanguageCodes([...supportedLanguages, normalized], supportedLanguages));
    setCustomLanguage('');
  };

  return (
    <form
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        <div className="sf-card-soft space-y-3 p-4">
          <div className="flex items-center justify-between">
            <label className="sf-label">App 名称 *</label>
            <span className="text-[11px] text-slate-500">{nameCount} 字符</span>
          </div>
          <input
            type="text"
            value={appName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="例如：appshots Pro"
            className="sf-input"
          />
          <p className="text-xs text-slate-400">建议简洁明确，便于 AI 提取核心卖点。</p>
        </div>

        <div className="sf-card-soft space-y-3 p-4">
          <div className="flex items-center justify-between">
            <label className="sf-label">一句话描述（可选）</label>
            <span className="text-[11px] text-slate-500">{descriptionCount} 字符</span>
          </div>
          <input
            type="text"
            value={appDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="例如：AI 驱动的应用商店截图生成器"
            className="sf-input"
          />
          <p className="text-xs text-slate-400">一句话定位会影响模板与文案语气。</p>
        </div>

        <div className="sf-card-soft space-y-3 p-4">
          <div className="flex items-center justify-between">
            <label className="sf-label">支持语言 *</label>
            <span className="text-[11px] text-slate-500">至少 1 种</span>
          </div>
          <p className="text-xs text-slate-400">AI 将在一次分析中直接返回所选语言的标题与副标题。</p>
          {languageSelectionLocked && languageLockHint && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {languageLockHint}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {languageOptions.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => toggleLanguage(code)}
                disabled={languageSelectionLocked}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  supportedLanguages.includes(code)
                    ? 'bg-primary-500/20 text-primary-100 ring-1 ring-primary-400/60'
                    : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
                } ${languageSelectionLocked ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {getLanguageLabel(code)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={customLanguage}
              onChange={(event) => setCustomLanguage(event.target.value)}
              placeholder="添加语言代码，例如：es / fr / de"
              className="sf-input max-w-[280px]"
              disabled={languageSelectionLocked}
            />
            <button
              type="button"
              onClick={addCustomLanguage}
              className="sf-btn-ghost px-3 py-1.5 text-xs"
              disabled={languageSelectionLocked}
            >
              添加语言
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
            已选：
            {supportedLanguages.map((code) => (
              <span key={code} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-slate-200">
                {getLanguageLabel(code)}
              </span>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!appName.trim() || isLoading || supportedLanguages.length === 0}
          className="sf-btn-primary w-full"
        >
          {isLoading ? 'AI 分析中...' : '开始 AI 分析'}
        </button>
      </div>

      <aside className="sf-card-soft hidden space-y-3 p-4 text-xs text-slate-300 lg:block">
        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">AI 会参考</p>
        <div className="space-y-2">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">核心功能关键词</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">目标用户场景</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">产品语气风格</div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">多语言营销文案输出</div>
        </div>
        <p className="text-[11px] text-slate-500">填写得越具体，AI 推荐越精准。</p>
      </aside>
    </form>
  );
}
