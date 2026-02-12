import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DEFAULT_EXPORT_LANGUAGES, dedupeLanguageCodes } from '@appshots/shared';
import type { UsageResponse } from '@appshots/shared';
import { useProjectStore } from '../stores/projectStore';
import { api } from '../api/client';
import { StepIndicator } from '../components/wizard/StepIndicator';
import { UploadZone } from '../components/upload/UploadZone';
import { AppInfoForm } from '../components/wizard/AppInfoForm';
import { ProcessingStatus } from '../components/wizard/ProcessingStatus';
import { MembershipWechatCard } from '../components/common/MembershipWechatCard';
import { useAuthStore } from '../stores/authStore';
import { membershipWechatLabel } from '../constants/membership';

export default function Creator() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const membership = useAuthStore((s) => s.membership);
  const authStatus = useAuthStore((s) => s.status);
  const {
    uploadedFiles,
    previewUrls,
    wizardStep,
    isAnalyzing,
    analysisError,
    setUploadedFiles,
    setWizardStep,
    setCurrentProject,
    setAnalyzing,
    setAnalysisError,
  } = useProjectStore();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>([...DEFAULT_EXPORT_LANGUAGES]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const mountedRef = useRef(true);
  const isAuthenticated = authStatus === 'authenticated' && !!user;
  const isMember = membership?.status === 'active';
  const languageSelectionLocked = isAuthenticated && !isMember;

  const usageText = useMemo(() => {
    if (!isAuthenticated) return '请先登录';
    if (usageLoading) return '载入中...';
    if (usage?.isMember || isMember) return '无限次';
    const used = usage?.analysisUsedToday ?? 0;
    return `${used}/1 次`;
  }, [isAuthenticated, isMember, usage?.analysisUsedToday, usage?.isMember, usageLoading]);

  const usageHint = useMemo(() => {
    if (!isAuthenticated) return '登录后可创建项目并触发 AI 分析。';
    if (isMember) return '会员支持多语言分析与无限调用。';
    const used = usage?.analysisUsedToday ?? 0;
    if (used >= 1) {
      return `今日免费额度已用完，明天可继续使用，或通过 ${membershipWechatLabel()} 手动开通会员解锁无限分析。`;
    }
    return `免费版每天 1 次分析，且仅支持中文文案；会员支持多语言与无限分析（${membershipWechatLabel()}）。`;
  }, [isAuthenticated, isMember, usage?.analysisUsedToday]);

  const loadUsage = useCallback(async () => {
    if (!isAuthenticated) {
      setUsage(null);
      setUsageLoading(false);
      return;
    }
    setUsageLoading(true);
    try {
      const usageInfo = await api.getUsage();
      if (!mountedRef.current) return;
      setUsage(usageInfo);
    } catch {
      if (!mountedRef.current) return;
      setUsage(null);
    } finally {
      if (mountedRef.current) {
        setUsageLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    if (languageSelectionLocked) {
      setSupportedLanguages(['zh']);
    }
  }, [languageSelectionLocked]);

  const handleUploadNext = () => {
    if (uploadedFiles.length >= 3) {
      setWizardStep('info');
    }
  };

  const handleAnalyze = async (nextName = appName, nextDescription = appDescription) => {
    if (isAnalyzing) return;
    if (!isAuthenticated) {
      setAnalysisError('请先登录后再创建和分析项目。');
      return;
    }
    const name = nextName.trim();
    const description = nextDescription.trim();
    const languages = languageSelectionLocked
      ? ['zh']
      : dedupeLanguageCodes(supportedLanguages, DEFAULT_EXPORT_LANGUAGES);
    if (!name) {
      setAnalysisError('请填写应用名称后再开始分析。');
      return;
    }
    if (languages.length === 0) {
      setAnalysisError('请至少选择一种支持语言后再开始分析。');
      return;
    }
    if (uploadedFiles.length < 3) {
      setAnalysisError('请至少上传 3 张截图后再开始分析。');
      setWizardStep('upload');
      return;
    }

    try {
      if (mountedRef.current) {
        setAnalyzing(true);
        setAnalysisError(null);
        setWizardStep('analyzing');
      }

      const project = await api.createProject({ appName: name, appDescription: description });
      const id = project.id as string;
      if (mountedRef.current) {
        setProjectId(id);
      }

      await api.uploadScreenshots(id, uploadedFiles);
      await api.analyzeProject(id, { languages });

      const fullProject = await api.getProject(id);
      if (mountedRef.current) {
        setCurrentProject(fullProject as never);
        setWizardStep('preview');
        navigate(languageSelectionLocked ? `/project/${id}?mode=export` : `/project/${id}`);
      }
      if (languageSelectionLocked) {
        void loadUsage();
      }
    } catch (err) {
      if (mountedRef.current) {
        setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
        setWizardStep('info');
      }
    } finally {
      if (mountedRef.current) {
        setAnalyzing(false);
      }
    }
  };

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-200/30 border-t-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-14">
        <div className="sf-card relative overflow-hidden p-8 sm:p-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-primary-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-accent-500/15 blur-3xl" />
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Creator Access</p>
          <h1 className="sf-display mt-3 text-3xl font-bold text-white">登录后即可开始制作项目</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            创建、上传、AI 分析与导出都需要登录账号。登录后项目会与账号绑定，支持跨设备继续编辑。
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              '免费版每天 1 次 AI 分析',
              `会员可解锁多语言与无限分析`,
              `微信联系手动开通：${membershipWechatLabel()}`,
            ].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/login" className="sf-btn-primary">
              去登录并开始
            </Link>
            <Link to="/" className="sf-btn-ghost">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="sf-display text-2xl font-bold text-white">创建新项目</h1>
        <p className="mt-1 text-sm text-slate-400">上传截图后，appshots 将自动完成 AI 分析、模板推荐和文案生成。</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">当前账号</span>
          <span className="text-sm text-slate-200">{user?.email ?? '-'}</span>
        </div>
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">套餐</span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
              isMember
                ? 'border border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
                : 'border border-white/15 bg-white/10 text-slate-200'
            }`}
          >
            {isMember ? 'Member' : 'Free'}
          </span>
        </div>
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">今日分析额度</span>
          <span className="text-sm text-slate-100">{usageText}</span>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
        {usageHint}
      </div>

      {!isMember && (
        <div className="mb-6">
          <MembershipWechatCard compact />
        </div>
      )}

      <div className="sf-card p-6 sm:p-8">
        <StepIndicator current={wizardStep} />

        {wizardStep === 'upload' && (
          <div>
            <h2 className="sf-display text-xl font-semibold text-white">上传 App 截图</h2>
            <p className="mt-1 text-sm text-slate-400">建议上传首页、核心流程和亮点功能页，推荐 3-5 张。</p>

            <div className="mt-6">
              <UploadZone files={uploadedFiles} previewUrls={previewUrls} onFilesChange={setUploadedFiles} />
            </div>

            <div className="mt-6">
              <button onClick={handleUploadNext} disabled={uploadedFiles.length < 3} className="sf-btn-primary">
                下一步：填写应用信息
              </button>
            </div>
          </div>
        )}

        {wizardStep === 'info' && (
          <div>
            <h2 className="sf-display text-xl font-semibold text-white">填写 App 信息</h2>
            <p className="mt-1 text-sm text-slate-400">让 AI 更准确理解你的产品定位，并一次返回多语言文案。</p>

            <div className="mt-6">
              <AppInfoForm
                appName={appName}
                appDescription={appDescription}
                supportedLanguages={supportedLanguages}
                onNameChange={(value) => {
                  setAppName(value);
                  if (analysisError) setAnalysisError(null);
                }}
                onDescriptionChange={(value) => {
                  setAppDescription(value);
                  if (analysisError) setAnalysisError(null);
                }}
                onSupportedLanguagesChange={(value) => {
                  setSupportedLanguages(dedupeLanguageCodes(value, DEFAULT_EXPORT_LANGUAGES));
                  if (analysisError) setAnalysisError(null);
                }}
                onSubmit={() => handleAnalyze()}
                isLoading={isAnalyzing}
                error={analysisError}
                languageSelectionLocked={languageSelectionLocked}
                languageLockHint={
                  languageSelectionLocked ? '免费版仅支持中文（zh）文案输出，升级会员可一次生成多语言。' : undefined
                }
              />
            </div>

            <button onClick={() => setWizardStep('upload')} className="sf-btn-ghost mt-4">
              返回上一步
            </button>
          </div>
        )}

        {wizardStep === 'analyzing' && <ProcessingStatus error={analysisError} />}

        {projectId && wizardStep === 'analyzing' && (
          <p className="mt-4 text-center text-xs text-slate-500">项目 ID：{projectId}</p>
        )}
      </div>
    </div>
  );
}
