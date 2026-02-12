import { useEffect, useMemo, useState } from 'react';
import {
  DEVICE_SIZES,
  dedupeLanguageCodes,
  getLanguageLabel,
} from '@appshots/shared';
import type { DeviceSizeId } from '@appshots/shared';
import { membershipWechatLabel } from '../../constants/membership';

interface ExportDialogProps {
  onExport: (options: { deviceSizes: DeviceSizeId[]; languages: string[]; includeWatermark: boolean }) => void;
  isExporting: boolean;
  exportProgress: number;
  exportStatus: string;
  isMember: boolean;
  screenshotCount: number;
  canExportProject: boolean;
  projectStatusLabel: string;
  availableLanguages: string[];
}

export function ExportDialog({
  onExport,
  isExporting,
  exportProgress,
  exportStatus,
  isMember,
  screenshotCount,
  canExportProject,
  projectStatusLabel,
  availableLanguages,
}: ExportDialogProps) {
  const [deviceSizes, setDeviceSizes] = useState<DeviceSizeId[]>(['6.7']);
  const languageOptions = useMemo(() => dedupeLanguageCodes(availableLanguages, ['zh', 'en']), [availableLanguages]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(() => [...languageOptions]);
  const deviceSelectionEmpty = deviceSizes.length === 0;
  const hasScreenshots = screenshotCount > 0;
  const estimatedOutput = hasScreenshots ? deviceSizes.length * selectedLanguages.length * screenshotCount : 0;
  const languageSelectionEmpty = selectedLanguages.length === 0;
  const exportDisabled = isExporting || deviceSelectionEmpty || languageSelectionEmpty || !hasScreenshots || !canExportProject;

  const toggleDevice = (id: DeviceSizeId) => {
    setDeviceSizes((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  useEffect(() => {
    setSelectedLanguages((prev) => {
      if (!isMember) {
        const fallback = languageOptions.includes('zh') ? 'zh' : languageOptions[0] ?? 'zh';
        return [fallback];
      }
      const retained = prev.filter((code) => languageOptions.includes(code));
      if (retained.length > 0) return retained;
      return [...languageOptions];
    });
  }, [isMember, languageOptions]);

  const toggleLanguage = (code: string) => {
    if (!isMember) {
      return;
    }
    setSelectedLanguages((prev) => (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]));
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
        <p className="mt-1 text-xs text-slate-400">
          {isMember
            ? '仅支持当前项目已生成的语言，可按需勾选/取消。'
            : '免费版导出仅支持 1 种语言（默认选择第一种）。'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {languageOptions.map((code) => (
            <button
              key={code}
              onClick={() => toggleLanguage(code)}
              disabled={!isMember}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                selectedLanguages.includes(code)
                  ? 'bg-primary-500/20 text-primary-100 ring-1 ring-primary-400/60'
                  : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
              } ${!isMember ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              {getLanguageLabel(code)}
            </button>
          ))}
        </div>
        {!isMember && (
          <p className="mt-2 text-xs text-amber-100">会员可开启多语言打包导出与无水印交付。</p>
        )}
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
            if (!isMember) {
              alert('无水印导出仅限会员使用。');
              return;
            }
            onExport({ deviceSizes, languages: selectedLanguages, includeWatermark: false });
          }}
          disabled={exportDisabled || !isMember}
          className="sf-btn-primary flex-1"
          title={isMember ? '高级导出（无水印）' : '会员可使用无水印导出'}
        >
          {isExporting ? '导出中...' : isMember ? '高级导出（无水印）' : '会员专享：无水印导出'}
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
        {isMember ? (
          <p>会员支持无水印导出，且高级导出 5 分钟内最多触发一次。</p>
        ) : (
          <p>
            免费版默认带水印且仅单语言导出，升级会员可解锁无水印与多语言导出（{membershipWechatLabel()}
            手动开通）。
          </p>
        )}
      </div>
    </div>
  );
}
