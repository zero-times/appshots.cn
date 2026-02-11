import { useState } from 'react';
import {
  DEVICE_SIZES,
  DEFAULT_EXPORT_LANGUAGES,
  dedupeLanguageCodes,
  getLanguageLabel,
  normalizeLanguageCode,
} from '@appshots/shared';
import type { DeviceSizeId } from '@appshots/shared';

interface ExportDialogProps {
  onExport: (options: { deviceSizes: DeviceSizeId[]; languages: string[]; includeWatermark: boolean }) => void;
  isExporting: boolean;
  exportProgress: number;
  exportStatus: string;
  canUseAdvancedExport: boolean;
  screenshotCount: number;
  canExportProject: boolean;
  projectStatusLabel: string;
}

export function ExportDialog({
  onExport,
  isExporting,
  exportProgress,
  exportStatus,
  canUseAdvancedExport,
  screenshotCount,
  canExportProject,
  projectStatusLabel,
}: ExportDialogProps) {
  const [deviceSizes, setDeviceSizes] = useState<DeviceSizeId[]>(['6.7']);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([...DEFAULT_EXPORT_LANGUAGES]);
  const [customLanguage, setCustomLanguage] = useState('');
  const deviceSelectionEmpty = deviceSizes.length === 0;
  const hasScreenshots = screenshotCount > 0;
  const estimatedOutput = hasScreenshots ? deviceSizes.length * selectedLanguages.length * screenshotCount : 0;
  const languageSelectionEmpty = selectedLanguages.length === 0;
  const exportDisabled = isExporting || deviceSelectionEmpty || languageSelectionEmpty || !hasScreenshots || !canExportProject;

  const toggleDevice = (id: DeviceSizeId) => {
    setDeviceSizes((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const toggleLanguage = (code: string) => {
    const normalized = normalizeLanguageCode(code);
    setSelectedLanguages((prev) =>
      prev.includes(normalized) ? prev.filter((item) => item !== normalized) : dedupeLanguageCodes([...prev, normalized]),
    );
  };

  const addCustomLanguage = () => {
    const normalized = normalizeLanguageCode(customLanguage);
    if (!normalized) return;
    setSelectedLanguages((prev) => dedupeLanguageCodes([...prev, normalized]));
    setCustomLanguage('');
  };

  return (
    <div className="sf-card max-w-2xl space-y-6 p-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">导出尺寸</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.values(DEVICE_SIZES).map((d) => {
            const checked = deviceSizes.includes(d.id);
            return (
              <label
                key={d.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  checked
                    ? 'border-primary-400/70 bg-primary-500/15 text-primary-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/25'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDevice(d.id)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-primary-500"
                />
                {d.name}
              </label>
            );
          })}
        </div>
        {deviceSelectionEmpty && (
          <p className="mt-2 text-xs text-amber-200">请至少选择一个尺寸用于导出。</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-200">导出语言</h3>
        <p className="mt-1 text-xs text-slate-400">默认提供中/英/葡萄牙语/日语/韩语，可按语言代码扩展。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {dedupeLanguageCodes([...DEFAULT_EXPORT_LANGUAGES, ...selectedLanguages]).map((code) => (
            <button
              key={code}
              onClick={() => toggleLanguage(code)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                selectedLanguages.includes(code)
                  ? 'bg-primary-500/20 text-primary-100 ring-1 ring-primary-400/60'
                  : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
              }`}
            >
              {getLanguageLabel(code)}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={customLanguage}
            onChange={(event) => setCustomLanguage(event.target.value)}
            placeholder="添加语言代码，例如：es / fr / de"
            className="sf-input max-w-[280px]"
          />
          <button type="button" onClick={addCustomLanguage} className="sf-btn-ghost px-3 py-1.5 text-xs">
            添加语言
          </button>
        </div>
        {languageSelectionEmpty && <p className="mt-2 text-xs text-amber-200">请至少选择一种语言用于导出。</p>}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="uppercase tracking-[0.18em] text-slate-500">导出摘要</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
            预计 {estimatedOutput} 张
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {deviceSizes.map((id) => (
            <span key={id} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-slate-200">
              {DEVICE_SIZES[id]?.name ?? id}
            </span>
          ))}
          {selectedLanguages.map((code) => (
            <span key={code} className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-slate-200">
              {getLanguageLabel(code)}
            </span>
          ))}
        </div>
        {!hasScreenshots && <p className="mt-2 text-[11px] text-amber-200">请先上传截图后再导出。</p>}
        {!canExportProject && (
          <p className="mt-2 text-[11px] text-amber-200">
            当前项目状态为「{projectStatusLabel}」，完成分析后即可导出。
          </p>
        )}
      </div>

      {(isExporting || exportProgress > 0) && (
        <div className="rounded-xl border border-primary-400/30 bg-primary-500/10 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-primary-100">{exportStatus || '正在导出...'}</span>
            <span className="tabular-nums text-primary-200">{Math.round(exportProgress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-900/70">
            <div
              className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-300"
              style={{ width: `${Math.max(exportProgress, 4)}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => onExport({ deviceSizes, languages: selectedLanguages, includeWatermark: true })}
          disabled={exportDisabled}
          className="sf-btn-ghost flex-1"
        >
          免费导出（带水印）
        </button>
        <button
          onClick={() => {
            if (!canUseAdvancedExport) {
              alert('请先登录后使用高级导出（无水印）。');
              return;
            }
            onExport({ deviceSizes, languages: selectedLanguages, includeWatermark: false });
          }}
          disabled={exportDisabled || !canUseAdvancedExport}
          className="sf-btn-primary flex-1"
          title={canUseAdvancedExport ? '高级导出（无水印）' : '登录后可使用高级导出（无水印）'}
        >
          {isExporting ? '导出中...' : canUseAdvancedExport ? '高级导出（无水印）' : '登录后可用高级导出'}
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
        {canUseAdvancedExport ? (
          <p>高级导出为无水印素材，5 分钟内仅可触发一次。</p>
        ) : (
          <p>登录后可解锁无水印导出，并同步历史项目与模板设置。</p>
        )}
      </div>
    </div>
  );
}
