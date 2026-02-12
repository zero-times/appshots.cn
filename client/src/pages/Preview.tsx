import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { api, type ExportJobStatusResponse } from '../api/client';
import { PreviewCanvas } from '../components/preview/PreviewCanvas';
import { CopyEditor } from '../components/editor/CopyEditor';
import { TemplatePicker } from '../components/template/TemplatePicker';
import { ExportDialog } from '../components/export/ExportDialog';
import { MembershipWechatCard } from '../components/common/MembershipWechatCard';
import { useAuthStore } from '../stores/authStore';
import { DEVICE_SIZES, TEMPLATES, dedupeLanguageCodes, getLanguageLabel } from '@appshots/shared';
import type { CompositionModeId, DeviceSizeId, GeneratedCopy, TemplateStyleId, UsageResponse } from '@appshots/shared';
import { membershipWechatLabel } from '../constants/membership';
import { usePageSeo } from '../utils/seo';

export default function Preview() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { currentProject, setCurrentProject, updateCopy, setTemplate } = useProjectStore();
  const authStatus = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const membership = useAuthStore((s) => s.membership);
  const isAuthenticated = authStatus === 'authenticated' && !!user;
  const isMember = membership?.status === 'active';
  const forceExportMode = searchParams.get('mode') === 'export';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lang, setLang] = useState<string>('zh');
  const [showHints, setShowHints] = useState(true);
  const [device, setDevice] = useState<DeviceSizeId>('6.7');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');
  const [latestZipUrl, setLatestZipUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const exportResetTimerRef = useRef<number | null>(null);
  const saveResetTimerRef = useRef<number | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const pendingPayloadRef = useRef<Record<string, unknown>>({});
  const isUnmountedRef = useRef(false);

  usePageSeo({
    title: currentProject?.appName ? `${currentProject.appName} 预览` : '项目预览',
    description: '预览截图构图、文案与导出设置，生成可下载的 ZIP 交付包。',
    path: id ? `/project/${id}` : '/project',
    noindex: !isAuthenticated,
  });

  const clearExportResetTimer = useCallback(() => {
    if (exportResetTimerRef.current !== null) {
      window.clearTimeout(exportResetTimerRef.current);
      exportResetTimerRef.current = null;
    }
  }, []);

  const clearSaveResetTimer = useCallback(() => {
    if (saveResetTimerRef.current !== null) {
      window.clearTimeout(saveResetTimerRef.current);
      saveResetTimerRef.current = null;
    }
  }, []);

  const clearSyncTimeout = useCallback(() => {
    if (syncTimeoutRef.current !== null) {
      window.clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
  }, []);

  const resetSyncState = useCallback(() => {
    clearSyncTimeout();
    pendingPayloadRef.current = {};
    syncInFlightRef.current = false;
    syncQueuedRef.current = false;
  }, [clearSyncTimeout]);

  const safeUpdate = useCallback((fn: () => void) => {
    if (!isUnmountedRef.current) {
      fn();
    }
  }, []);

  const previewLanguages = dedupeLanguageCodes(
    [
      ...(currentProject?.generatedCopy?.headlines ?? []).flatMap((item) =>
        Object.keys(item).filter((key) => key !== 'screenshotIndex'),
      ),
      ...(currentProject?.generatedCopy?.subtitles ?? []).flatMap((item) =>
        Object.keys(item).filter((key) => key !== 'screenshotIndex'),
      ),
      ...Object.keys(currentProject?.generatedCopy?.tagline ?? {}),
    ],
    ['zh', 'en'],
  );

  useEffect(() => {
    if (!previewLanguages.includes(lang)) {
      setLang(previewLanguages[0] ?? 'zh');
    }
  }, [lang, previewLanguages]);

  useEffect(() => {
    if (forceExportMode) {
      setShowExport(true);
    }
  }, [forceExportMode]);

  useEffect(() => {
    if (isAuthenticated && !isMember) {
      setShowExport(true);
    }
  }, [isAuthenticated, isMember]);

  useEffect(() => {
    if (authStatus === 'loading' || authStatus === 'idle') {
      return;
    }
    if (authStatus === 'unauthenticated') {
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    if (!id) {
      setLoadError('缺少项目 ID');
      setIsLoading(false);
      return;
    }

    if (currentProject?.id === id) {
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setLoadError(null);
    api
      .getProject(id)
      .then((p) => {
        if (!isActive || isUnmountedRef.current) return;
        setCurrentProject(p as never);
        setLatestZipUrl(((p as Record<string, unknown>).lastExportZipUrl as string | null) ?? null);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isActive || isUnmountedRef.current) return;
        const message = err instanceof Error ? err.message : '加载失败，请稍后重试';
        setLoadError(message);
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [authStatus, id, currentProject?.id, reloadKey, setCurrentProject]);

  useEffect(() => {
    if (!currentProject) return;
    setLatestZipUrl(currentProject.lastExportZipUrl ?? null);
  }, [currentProject?.id, currentProject?.lastExportZipUrl]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUsage(null);
      return;
    }
    let cancelled = false;
    api
      .getUsage()
      .then((data) => {
        if (cancelled || isUnmountedRef.current) return;
        setUsage(data);
      })
      .catch(() => {
        if (cancelled || isUnmountedRef.current) return;
        setUsage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, membership?.status]);

  useEffect(() => {
    isUnmountedRef.current = false;

    return () => {
      isUnmountedRef.current = true;
      clearExportResetTimer();
      clearSaveResetTimer();
      resetSyncState();
    };
  }, [clearExportResetTimer, clearSaveResetTimer, resetSyncState]);

  useEffect(() => {
    setSaveStatus('idle');
    setSaveMessage(null);
    resetSyncState();
  }, [currentProject?.id, resetSyncState]);

  const flushSync = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!id) return;

      safeUpdate(() => {
        setSaveStatus('saving');
        setSaveMessage(null);
      });
      clearSaveResetTimer();

      try {
        await api.updateProject(id, payload);
        safeUpdate(() => {
          setSaveStatus('saved');
          setSaveMessage('已同步');
          setRefreshKey((k) => k + 1);
        });
        saveResetTimerRef.current = window.setTimeout(() => {
          if (isUnmountedRef.current) return;
          setSaveStatus('idle');
          setSaveMessage(null);
          saveResetTimerRef.current = null;
        }, 2200);
      } catch (err) {
        const message = err instanceof Error ? err.message : '同步失败，请稍后重试。';
        safeUpdate(() => {
          setSaveStatus('error');
          setSaveMessage(message);
        });
      }
    },
    [clearSaveResetTimer, id, safeUpdate],
  );

  const syncProject = useCallback(
    (payload: Record<string, unknown>) => {
      pendingPayloadRef.current = { ...pendingPayloadRef.current, ...payload };
      if (Object.keys(pendingPayloadRef.current).length === 0) return;
      safeUpdate(() => {
        setSaveStatus('saving');
        setSaveMessage(null);
      });
      clearSaveResetTimer();

      if (syncInFlightRef.current) {
        syncQueuedRef.current = true;
        return;
      }

      if (syncTimeoutRef.current !== null) return;
      syncTimeoutRef.current = window.setTimeout(async () => {
        syncTimeoutRef.current = null;
        if (isUnmountedRef.current) return;
        if (!id) return;
        if (syncInFlightRef.current) return;
        syncInFlightRef.current = true;
        const nextPayload = pendingPayloadRef.current;
        pendingPayloadRef.current = {};

        await flushSync(nextPayload);
        syncInFlightRef.current = false;

        if (syncQueuedRef.current || Object.keys(pendingPayloadRef.current).length > 0) {
          syncQueuedRef.current = false;
          if (Object.keys(pendingPayloadRef.current).length > 0) {
            syncProject({});
          }
        }
      }, 520);
    },
    [clearSaveResetTimer, flushSync, id, safeUpdate],
  );

  const handleCopyChange = useCallback(
    (copy: GeneratedCopy) => {
      if (currentProject?.status === 'completed' || isExporting) return;
      updateCopy(copy);
      void syncProject({ generatedCopy: copy });
    },
    [currentProject?.status, isExporting, syncProject, updateCopy],
  );

  const handleTemplateChange = useCallback(
    (templateId: TemplateStyleId) => {
      if (currentProject?.status === 'completed' || isExporting) return;
      setTemplate(templateId);
      void syncProject({ templateStyle: templateId });
    },
    [currentProject?.status, isExporting, setTemplate, syncProject],
  );

  const waitUntilExportDone = useCallback((jobId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (typeof EventSource === 'undefined') {
        reject(new Error('当前浏览器不支持 SSE 导出进度。'));
        return;
      }

      const source = new EventSource(api.getExportJobStreamUrl(jobId));
      let isDone = false;

      const done = (next: () => void) => {
        if (isDone) return;
        isDone = true;
        source.close();
        next();
      };

      const fail = (message: string) => {
        done(() => reject(new Error(message)));
      };

      const handleStatus = (job: ExportJobStatusResponse) => {
        if (isUnmountedRef.current) {
          fail('页面已关闭，导出进度监听已停止。');
          return;
        }

        setExportProgress(job.progress);
        setExportStatus(job.message || '正在导出...');

        if (job.status === 'completed') {
          if (!job.zipUrl) {
            fail('导出完成但未找到下载地址。');
            return;
          }

          done(() => resolve(job.zipUrl!));
          return;
        }

        if (job.status === 'failed') {
          fail(job.error || job.message || '导出失败，请重试。');
        }
      };

      const onProgress = (evt: MessageEvent<string>) => {
        if (isDone) return;

        try {
          const payload = JSON.parse(evt.data) as ExportJobStatusResponse;
          handleStatus(payload);
        } catch {
          fail('导出进度解析失败，请重试。');
        }
      };

      source.onmessage = onProgress;
      source.addEventListener('progress', (evt) => onProgress(evt as MessageEvent<string>));
      source.onerror = () => {
        if (isDone) return;
        fail('导出进度连接中断，请重试。');
      };
    });
  }, []);

  const handleExport = async (options: {
    deviceSizes: DeviceSizeId[];
    languages: string[];
    includeWatermark: boolean;
  }) => {
    if (!id) return;
    if (currentProject?.status === 'completed') {
      alert('该项目已封存，请直接使用下载地址。');
      return;
    }
    if (!isAuthenticated) {
      alert('请先登录后再导出。');
      return;
    }

    const safeExportUpdate = (fn: () => void) => {
      if (isUnmountedRef.current) return;
      fn();
    };

    try {
      isUnmountedRef.current = false;
      safeExportUpdate(() => setIsExporting(true));
      safeExportUpdate(() => clearExportResetTimer());
      safeExportUpdate(() => setExportProgress(1));
      safeExportUpdate(() => setExportStatus('正在创建导出任务...'));

      const job = await api.startExportJob(id, {
        ...options,
        projectId: id,
        format: 'png',
      });

      safeExportUpdate(() => setExportProgress(job.progress));
      safeExportUpdate(() => setExportStatus(job.message || '导出任务已创建。'));

      const zipUrl = await waitUntilExportDone(job.jobId);

      safeExportUpdate(() => setExportProgress(100));
      safeExportUpdate(() => setExportStatus('导出完成，请点击下载按钮获取 ZIP。'));
      safeExportUpdate(() => {
        setLatestZipUrl(zipUrl);
        setShowExport(true);
      });
      const refreshed = await api.getProject(id);
      safeExportUpdate(() => {
        setCurrentProject(refreshed as never);
        const persistedZip = (refreshed as Record<string, unknown>).lastExportZipUrl;
        if (typeof persistedZip === 'string' && persistedZip.length > 0) {
          setLatestZipUrl(persistedZip);
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      safeExportUpdate(() => setExportStatus(message));
      if (!isUnmountedRef.current) {
        alert(message);
      }
    } finally {
      safeExportUpdate(() => setIsExporting(false));
      safeExportUpdate(() => clearExportResetTimer());
      if (!isUnmountedRef.current) {
        exportResetTimerRef.current = window.setTimeout(() => {
          if (isUnmountedRef.current) return;
          setExportProgress(0);
          setExportStatus('');
          exportResetTimerRef.current = null;
        }, 1600);
      }
    }
  };

  if (authStatus === 'unauthenticated') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="sf-card p-10 text-center">
          <h2 className="sf-display text-2xl font-bold text-white">请先登录后查看项目</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300">登录后可继续编辑、导出并管理你的项目资产。</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/login" className="sf-btn-primary">
              去登录
            </Link>
            <Link to="/" className="sf-btn-ghost">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="sf-card p-10 text-center">
          <h2 className="sf-display text-2xl font-bold text-white">项目加载失败</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300">{loadError}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/history" className="sf-btn-ghost">
              返回项目中心
            </Link>
            <button
              onClick={() => {
                setLoadError(null);
                setReloadKey((k) => k + 1);
              }}
              className="sf-btn-primary"
            >
              重试加载
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !currentProject) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-200/30 border-t-primary-500" />
      </div>
    );
  }

  const screenshotCount = currentProject.screenshotPaths?.length || 0;
  const deviceLabel = DEVICE_SIZES[device]?.name ?? device;
  const statusLabelMap: Record<string, string> = {
    draft: '草稿',
    analyzing: 'AI 分析中',
    ready: '可预览',
    exporting: '导出中',
    completed: '已封存',
  };
  const statusLabel = statusLabelMap[currentProject.status] || currentProject.status;
  const isExportLocked = currentProject.status === 'completed';
  const canExportProject = currentProject.status === 'ready';
  const updatedAt = currentProject.updatedAt || currentProject.createdAt;
  const updatedText = updatedAt
    ? new Date(updatedAt).toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '未知时间';
  const templateMeta = TEMPLATES[currentProject.templateStyle];
  const recommendedMeta = currentProject.aiAnalysis?.recommendedTemplate
    ? TEMPLATES[currentProject.aiAnalysis.recommendedTemplate]
    : null;
  const compositionModeLabels: Record<CompositionModeId, string> = {
    'flow-drift': '连贯走向 + 边界漂移',
    'story-slice': '故事线切片跨屏',
  };
  const recommendedMode = currentProject.aiAnalysis?.recommendedCompositionMode;
  const recommendedCombo = currentProject.aiAnalysis?.recommendedTemplateCombo ?? [];
  const featureList = currentProject.aiAnalysis?.keyFeatures?.slice(0, 4) ?? [];
  const copyMaps = currentProject.generatedCopy
    ? (() => {
        const headlineMap = new Map<number, Record<string, string | number>>();
        const subtitleMap = new Map<number, Record<string, string | number>>();

        currentProject.generatedCopy.headlines?.forEach((item) => {
          if (typeof item.screenshotIndex === 'number') {
            headlineMap.set(item.screenshotIndex, item);
          }
        });
        currentProject.generatedCopy.subtitles?.forEach((item) => {
          if (typeof item.screenshotIndex === 'number') {
            subtitleMap.set(item.screenshotIndex, item);
          }
        });

        return { headlineMap, subtitleMap };
      })()
    : null;
  const saveStatusMeta = {
    idle: { label: '自动同步已开启', className: 'bg-white/5 text-slate-300 ring-1 ring-white/10' },
    saving: { label: '同步中...', className: 'bg-primary-500/15 text-primary-100 ring-1 ring-primary-400/40' },
    saved: { label: '已同步', className: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/40' },
    error: { label: '同步失败', className: 'bg-rose-500/15 text-rose-100 ring-1 ring-rose-400/40' },
  }[saveStatus];
  const completionSummary = currentProject.generatedCopy
    ? (() => {
        const total = screenshotCount;
        if (total === 0) return { completed: 0, partial: 0, empty: 0 };
        if (!copyMaps) return { completed: 0, partial: 0, empty: 0 };
        let completed = 0;
        let partial = 0;
        let empty = 0;

        for (let i = 0; i < total; i += 1) {
          const headlineValue = copyMaps.headlineMap.get(i)?.[lang];
          const subtitleValue = copyMaps.subtitleMap.get(i)?.[lang];
          const headline = typeof headlineValue === 'string' ? headlineValue : '';
          const subtitle = typeof subtitleValue === 'string' ? subtitleValue : '';
          const hasHeadline = headline.trim().length > 0;
          const hasSubtitle = subtitle.trim().length > 0;
          if (hasHeadline && hasSubtitle) completed += 1;
          else if (hasHeadline || hasSubtitle) partial += 1;
          else empty += 1;
        }

        return { completed, partial, empty };
      })()
    : null;
  const copyStatusByIndex = currentProject.generatedCopy
    ? (() => {
        if (!copyMaps) return [];
        return Array.from({ length: screenshotCount }, (_, index) => {
          const headlineValue = copyMaps.headlineMap.get(index)?.[lang];
          const subtitleValue = copyMaps.subtitleMap.get(index)?.[lang];
          const headline = typeof headlineValue === 'string' ? headlineValue : '';
          const subtitle = typeof subtitleValue === 'string' ? subtitleValue : '';
          const hasHeadline = headline.trim().length > 0;
          const hasSubtitle = subtitle.trim().length > 0;
          if (hasHeadline && hasSubtitle) return 'complete';
          if (hasHeadline || hasSubtitle) return 'partial';
          return 'empty';
        });
      })()
    : [];
  const completionText = (() => {
    if (!currentProject.generatedCopy) return '等待生成文案';
    if (screenshotCount === 0) return '等待上传截图';
    if (!completionSummary) return '等待生成文案';
    return `已完成 ${completionSummary.completed} / ${screenshotCount}`;
  })();
  const canUseEditor = Boolean(isMember) && !isExportLocked;
  const shouldShowExport = showExport || !canUseEditor || isExportLocked;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-[0_20px_50px_rgba(6,7,12,0.45)] backdrop-blur">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Preview Studio</p>
          <h2 className="sf-display mt-2 text-2xl font-bold text-white">{currentProject.appName}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
              {screenshotCount} 张截图
            </span>
            <span className="rounded-full border border-primary-400/30 bg-primary-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-primary-100">
              {statusLabel}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${saveStatusMeta.className}`}>
              {saveStatusMeta.label}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${
                isMember
                  ? 'border border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
                  : 'border border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              {isMember ? 'Member' : 'Free'}
            </span>
            {isAuthenticated && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                {isMember ? '分析额度：无限' : `今日分析：${usage?.analysisUsedToday ?? 0}/1`}
              </span>
            )}
            {saveMessage && saveStatus === 'error' && <span className="text-rose-200">{saveMessage}</span>}
            {saveStatus === 'saving' && <span className="text-[11px] text-slate-500">自动合并变更中…</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">最近更新：{updatedText}</p>
        </div>

        {canUseEditor ? (
          <button
            onClick={() => setShowExport(!showExport)}
            disabled={isExporting}
            className={showExport ? 'sf-btn-ghost' : 'sf-btn-primary'}
          >
            {isExporting ? `导出中 ${Math.round(exportProgress)}%` : showExport ? '返回编辑' : '导出素材'}
          </button>
        ) : isExportLocked ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-right text-xs text-emerald-100">
            <p>项目已完成导出并封存，编辑与参数设置已锁定。</p>
            {latestZipUrl ? <p className="mt-1 text-emerald-50/90">可直接点击下载按钮获取 ZIP。</p> : null}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-right text-xs text-amber-100">
            <p>免费版仅支持导出交付，编辑功能为会员专享。</p>
            <p className="mt-1 text-amber-50/90">开通会员请联系 {membershipWechatLabel()}</p>
          </div>
        )}
      </div>

      {shouldShowExport ? (
        <div className="mx-auto max-w-3xl space-y-4">
          {latestZipUrl && (
            <div className="sf-card-soft rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">导出结果</p>
              <div className="mt-3">
                <a href={latestZipUrl} target="_blank" rel="noreferrer" className="sf-btn-primary inline-flex whitespace-nowrap">
                  下载 ZIP
                </a>
              </div>
            </div>
          )}
          {!canUseEditor && !isExportLocked && (
            <div className="sf-card-soft rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">会员功能说明</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  '预览编辑（模板与文案）',
                  '多语言分析与导出',
                  '无水印导出',
                  `微信手动开通：${membershipWechatLabel()}`,
                ].map((item) => (
                  <div key={item} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <MembershipWechatCard compact />
              </div>
            </div>
          )}
          <ExportDialog
            onExport={handleExport}
            isExporting={isExporting}
            exportProgress={exportProgress}
            exportStatus={exportStatus}
            isMember={Boolean(isMember)}
            isLocked={isExportLocked}
            screenshotCount={screenshotCount}
            canExportProject={canExportProject}
            projectStatusLabel={statusLabel}
            availableLanguages={previewLanguages}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="sf-card-soft space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">项目信息</h3>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-slate-500">Project Insight</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                  {templateMeta?.nameZh ?? '模板'}
                </span>
              </div>
              {currentProject.appDescription ? (
                <p className="text-sm text-slate-300">{currentProject.appDescription}</p>
              ) : (
                <p className="text-sm text-slate-500">暂无项目描述，可在「创建」流程中补充。</p>
              )}

              {currentProject.aiAnalysis ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      类型：{currentProject.aiAnalysis.appType || '未识别'}
                    </span>
                    {recommendedMeta && (
                      <span className="rounded-full border border-primary-400/30 bg-primary-500/10 px-2.5 py-1 text-primary-100">
                        推荐模板：{recommendedMeta.nameZh}
                      </span>
                    )}
                    {recommendedMode && (
                      <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-violet-100">
                        推荐构图：{compositionModeLabels[recommendedMode]}
                      </span>
                    )}
                  </div>

                  {recommendedCombo.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">AI 推荐组合</p>
                      <div className="flex flex-wrap gap-2">
                        {recommendedCombo.map((item, index) => {
                          const comboTemplate = TEMPLATES[item.template];
                          return (
                            <button
                              key={`${item.template}-${index}`}
                              type="button"
                              onClick={() => handleTemplateChange(item.template)}
                              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-slate-200 transition hover:border-primary-300/40 hover:bg-primary-500/10"
                              title={item.reason}
                            >
                              {index + 1}. {comboTemplate?.nameZh ?? item.template} ·{' '}
                              {compositionModeLabels[item.compositionMode]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {featureList.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {featureList.map((item, index) => (
                        <span
                          key={`${item}-${index}`}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                  AI 分析结果尚未生成，可返回上一步重新触发分析。
                </div>
              )}
            </div>
            {canUseEditor && (
              <TemplatePicker
                selected={currentProject.templateStyle}
                recommended={currentProject.aiAnalysis?.recommendedTemplate}
                onChange={handleTemplateChange}
              />
            )}
            {canUseEditor && currentProject.generatedCopy ? (
              <div className="space-y-3">
                <div className="sf-card-soft flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">文案完成度</p>
                    <p className="mt-1 text-sm text-slate-200">{completionText}</p>
                  </div>
                  {completionSummary && screenshotCount > 0 && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-100">
                        完整 {completionSummary.completed}
                      </span>
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-amber-100">
                        部分 {completionSummary.partial}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
                        未填 {completionSummary.empty}
                      </span>
                    </div>
                  )}
                </div>
                <CopyEditor
                  copy={currentProject.generatedCopy}
                  screenshotCount={screenshotCount}
                  currentIndex={currentIndex}
                  onIndexChange={setCurrentIndex}
                  onCopyChange={handleCopyChange}
                />
              </div>
            ) : isExportLocked ? (
              <div className="sf-card-soft space-y-2 px-4 py-3 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">项目封存</p>
                <p>导出成功后，截图和文案已自动清理，仅保留 ZIP 下载地址。</p>
              </div>
            ) : (
              <div className="sf-card-soft space-y-2 px-4 py-3 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">文案编辑</p>
                <p>AI 文案尚未生成，当前仅可预览模板与截图顺序。</p>
                <p className="text-xs text-slate-500">若需要重新分析，可返回创建流程重新触发分析。</p>
              </div>
            )}
          </div>

          <div className="sf-card self-start p-4 sm:p-6 xl:sticky xl:top-6">
            <PreviewCanvas
              projectId={id!}
              screenshotCount={screenshotCount}
              currentIndex={currentIndex}
              template={currentProject.templateStyle}
              lang={lang}
              device={device}
              deviceLabel={deviceLabel}
              onIndexChange={setCurrentIndex}
              refreshKey={refreshKey}
              copyStatusByIndex={copyStatusByIndex}
            />

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">预览语言</span>
                  <select value={lang} onChange={(event) => setLang(event.target.value)} className="sf-select">
                    {previewLanguages.map((code) => (
                      <option key={code} value={code}>
                        {getLanguageLabel(code)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-500">设备尺寸</span>
                  <select
                    value={device}
                    onChange={(e) => setDevice(e.target.value as DeviceSizeId)}
                    className="sf-select"
                  >
                    {Object.values(DEVICE_SIZES).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setRefreshKey((k) => k + 1)} className="sf-btn-ghost px-3 py-1.5">
                    刷新预览
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                <span>方向键切换截图</span>
                <button
                  type="button"
                  onClick={() => setShowHints((prev) => !prev)}
                  className="text-[11px] uppercase tracking-[0.2em] text-slate-400 transition hover:text-slate-200"
                >
                  {showHints ? '隐藏提示' : '显示提示'}
                </button>
                <span>当前：{deviceLabel}</span>
              </div>
            </div>

            {showHints && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sf-card-soft space-y-2 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">推荐顺序</p>
                  <p className="text-sm text-slate-300">保持故事线一致：从核心价值到关键功能，最后补充证据与背书。</p>
                </div>
                <div className="sf-card-soft space-y-2 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">可视化建议</p>
                  <p className="text-sm text-slate-300">主标题聚焦行动或结果，副标题解释功能细节，避免堆叠形容词。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
