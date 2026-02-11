import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import { TEMPLATES, getLanguageLabel } from '@appshots/shared';
import type { DeviceSizeId, TemplateStyleId } from '@appshots/shared';

interface PreviewCanvasProps {
  projectId: string;
  screenshotCount: number;
  currentIndex: number;
  template: TemplateStyleId;
  lang: string;
  device: DeviceSizeId;
  deviceLabel?: string;
  onIndexChange: (index: number) => void;
  refreshKey: number;
  copyStatusByIndex?: Array<'complete' | 'partial' | 'empty'>;
}

export function PreviewCanvas({
  projectId,
  screenshotCount,
  currentIndex,
  template,
  lang,
  device,
  deviceLabel,
  onIndexChange,
  refreshKey,
  copyStatusByIndex,
}: PreviewCanvasProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const cardRefs = useRef(new Map<number, HTMLButtonElement | null>());

  const hasScreenshots = screenshotCount > 0;
  const previewIndexes = useMemo(
    () => (hasScreenshots ? Array.from({ length: screenshotCount }, (_, index) => index) : []),
    [hasScreenshots, screenshotCount],
  );

  const displayIndex = hasScreenshots ? Math.min(currentIndex, screenshotCount - 1) : 0;
  const previewUrl = hasScreenshots
    ? api.getPreviewUrl(projectId, displayIndex, template, lang, device) + `&t=${refreshKey}-${retryKey}`
    : '';

  const langLabel = getLanguageLabel(lang);
  const deviceName = deviceLabel ?? device;
  const compositionMode = TEMPLATES[template]?.compositionMode;
  const compositionModeLabel =
    compositionMode === 'story-slice' ? '故事线切片模式' : compositionMode === 'flow-drift' ? '连贯走向模式' : '默认模式';

  useEffect(() => {
    if (!hasScreenshots) {
      setLoading(false);
      if (currentIndex !== 0) {
        onIndexChange(0);
      }
      return;
    }

    if (currentIndex !== displayIndex) {
      onIndexChange(displayIndex);
      return;
    }
  }, [currentIndex, displayIndex, hasScreenshots, onIndexChange]);

  useEffect(() => {
    if (!hasScreenshots) return;
    setLoading(true);
    setLoadError(null);
  }, [previewUrl, hasScreenshots]);

  useEffect(() => {
    if (!hasScreenshots) return;

    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onIndexChange(Math.max(0, displayIndex - 1));
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        onIndexChange(Math.min(screenshotCount - 1, displayIndex + 1));
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [displayIndex, hasScreenshots, onIndexChange, screenshotCount]);

  useEffect(() => {
    if (!hasScreenshots) return;
    const activeEl = cardRefs.current.get(displayIndex);
    if (!activeEl) return;
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [displayIndex, hasScreenshots]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[420px]">
        <div className="pointer-events-none absolute -inset-4 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.25),transparent_60%)] opacity-70" />
        <div className="relative rounded-[28px] border border-white/10 bg-slate-950/75 p-3 shadow-[0_28px_80px_rgba(6,7,12,0.7)]">
          <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_60%)]" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-2">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_45%)]" />
            {hasScreenshots ? (
              <>
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-200/30 border-t-primary-500" />
                  </div>
                )}
                <img
                  src={previewUrl}
                  alt={`Preview ${displayIndex + 1}`}
                  className="w-full rounded-lg"
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setLoadError('预览加载失败，请重试。');
                  }}
                />
                {loadError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 px-6 text-center">
                    <p className="text-sm text-slate-200">{loadError}</p>
                    <button onClick={() => setRetryKey((key) => key + 1)} className="sf-btn-ghost px-3 py-1.5">
                      重试加载
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-[460px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 bg-white/5 px-6 text-center">
                <div className="sf-badge">尚无截图</div>
                <p className="text-sm text-slate-300">请先上传截图，再进入预览与编辑</p>
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-200 shadow-[0_10px_30px_rgba(10,11,18,0.5)]">
            {deviceName} · {langLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => onIndexChange(Math.max(0, displayIndex - 1))}
          disabled={!hasScreenshots || displayIndex === 0}
          className="sf-btn-ghost px-3 py-1.5"
        >
          上一张
        </button>
        <span className="text-sm text-slate-300">
          {hasScreenshots ? displayIndex + 1 : 0} / {screenshotCount}
        </span>
        <button
          onClick={() => onIndexChange(Math.min(screenshotCount - 1, displayIndex + 1))}
          disabled={!hasScreenshots || displayIndex === screenshotCount - 1}
          className="sf-btn-ghost px-3 py-1.5"
        >
          下一张
        </button>
      </div>

      {hasScreenshots && (
        <div className="mt-6 w-full max-w-[860px] rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">商店横排预览</p>
              <p className="mt-1 text-xs text-slate-400">模拟应用商店从左到右浏览，检查跨屏构图是否连贯</p>
              <p className="mt-1 text-[11px] text-slate-500">当前：{compositionModeLabel}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
              共 {screenshotCount} 张
            </span>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-white/0 via-white/35 to-white/0" />
            <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
              {previewIndexes.map((index) => (
                <SequencePreviewCard
                  key={`${projectId}-${index}`}
                  projectId={projectId}
                  index={index}
                  template={template}
                  lang={lang}
                  device={device}
                  refreshKey={refreshKey}
                  isActive={index === displayIndex}
                  copyStatus={copyStatusByIndex?.[index]}
                  onSelect={() => onIndexChange(index)}
                  buttonRef={(el) => {
                    cardRefs.current.set(index, el);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SequencePreviewCardProps {
  projectId: string;
  index: number;
  template: TemplateStyleId;
  lang: string;
  device: DeviceSizeId;
  refreshKey: number;
  isActive: boolean;
  copyStatus?: 'complete' | 'partial' | 'empty';
  onSelect: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

function SequencePreviewCard({
  projectId,
  index,
  template,
  lang,
  device,
  refreshKey,
  isActive,
  copyStatus,
  onSelect,
  buttonRef,
}: SequencePreviewCardProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [hasError, setHasError] = useState(false);

  const thumbUrl =
    api.getPreviewUrl(projectId, index, template, lang, device) + `&t=seq-${refreshKey}-${retryKey}`;
  const statusLabel = copyStatus
    ? {
        complete: '完整',
        partial: '部分',
        empty: '待填',
      }[copyStatus]
    : null;
  const statusTone = copyStatus
    ? {
        complete: 'bg-emerald-500/80 text-emerald-50 ring-emerald-200/70',
        partial: 'bg-amber-500/80 text-amber-50 ring-amber-200/70',
        empty: 'bg-white/15 text-slate-100 ring-white/30',
      }[copyStatus]
    : null;

  useEffect(() => {
    setHasError(false);
  }, [thumbUrl]);

  return (
    <button
      type="button"
      onClick={onSelect}
      ref={buttonRef}
      className={`group relative h-[210px] w-[120px] flex-shrink-0 overflow-hidden rounded-xl border transition ${
        isActive
          ? 'border-primary-300/80 shadow-[0_0_0_1px_rgba(129,140,248,0.4),0_12px_24px_rgba(10,11,18,0.45)]'
          : 'border-white/10 hover:border-white/30'
      }`}
      aria-label={`查看第 ${index + 1} 张`}
    >
      {!hasError ? (
        <img
          src={thumbUrl}
          alt={`Preview ${index + 1}`}
          className="h-full w-full bg-slate-950 object-contain"
          onLoad={() => setHasError(false)}
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900/70 text-[10px] text-slate-300">
          <span>加载失败</span>
          <span className="text-[9px] text-primary-200">点击重试</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0)_55%,rgba(2,6,23,0.72)_100%)]" />
      <span className="absolute bottom-1.5 right-1.5 rounded-full bg-slate-950/70 px-2 py-0.5 text-[10px] text-slate-100 ring-1 ring-white/10">
        {String(index + 1).padStart(2, '0')}
      </span>
      {statusLabel && statusTone && (
        <span
          className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] ring-1 ${statusTone}`}
        >
          {statusLabel}
        </span>
      )}

      {hasError && (
        <span
          className="absolute inset-0"
          onClick={(event) => {
            event.stopPropagation();
            setRetryKey((key) => key + 1);
            setHasError(false);
          }}
          role="presentation"
        />
      )}
    </button>
  );
}
