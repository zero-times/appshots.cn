import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';

interface ProjectItem {
  id: string;
  appName: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  templateStyle?: string;
  screenshotPaths: string[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  analyzing: 'AI 分析中',
  ready: '可预览',
  exporting: '导出中',
  completed: '已完成',
};

interface PreviewTileProps {
  projectId: string;
  index: number;
  hasPreview: boolean;
  template: string;
  stamp: string;
}

function PreviewTile({ projectId, index, hasPreview, template, stamp }: PreviewTileProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [hasError, setHasError] = useState(false);

  const previewUrl = hasPreview
    ? `${api.getPreviewUrl(projectId, index, template, 'zh', '6.7')}&t=${stamp}-${retryKey}`
    : '';

  useEffect(() => {
    setHasError(false);
  }, [previewUrl, hasPreview]);

  return (
    <div className="group relative aspect-[9/16] overflow-hidden rounded-lg border border-white/10 bg-slate-900/80">
      {hasPreview ? (
        <>
          <img
            src={previewUrl}
            alt={`Preview ${index + 1}`}
            className="h-full w-full object-cover"
            onLoad={() => setHasError(false)}
            onError={() => setHasError(true)}
          />
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 px-3 text-center text-[11px] text-slate-200">
              <span>预览加载失败</span>
              <button
                type="button"
                onClick={() => setRetryKey((key) => key + 1)}
                className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] text-slate-100"
              >
                重试
              </button>
            </div>
          )}
          {!hasError && (
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">待上传</div>
      )}
      <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-slate-200 ring-1 ring-white/10">
        {index + 1}
      </span>
    </div>
  );
}

export default function History() {
  const user = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'draft' | 'analyzing'>('all');
  const mountedRef = useRef(true);

  const isAuthenticated = useMemo(() => authStatus === 'authenticated' && !!user, [authStatus, user]);

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
  }, [projects]);

  const stats = useMemo(() => {
    const summary = {
      total: projects.length,
      ready: 0,
      draft: 0,
      analyzing: 0,
    };
    projects.forEach((p) => {
      if (p.status === 'ready' || p.status === 'completed') summary.ready += 1;
      if (p.status === 'draft') summary.draft += 1;
      if (p.status === 'analyzing') summary.analyzing += 1;
    });
    return summary;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return sortedProjects;
    if (statusFilter === 'ready') {
      return sortedProjects.filter((p) => p.status === 'ready' || p.status === 'completed');
    }
    return sortedProjects.filter((p) => p.status === statusFilter);
  }, [sortedProjects, statusFilter]);

  const filterOptions = useMemo(
    () => [
      { id: 'all', label: '全部', count: stats.total },
      { id: 'ready', label: '可预览', count: stats.ready },
      { id: 'draft', label: '草稿', count: stats.draft },
      { id: 'analyzing', label: '分析中', count: stats.analyzing },
    ],
    [stats.analyzing, stats.draft, stats.ready, stats.total],
  );

  const loadProjects = useCallback(async () => {
    if (!isAuthenticated) {
      if (mountedRef.current) {
        setProjects([]);
        setLoading(false);
        setError(null);
      }
      return;
    }

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await api.listProjects();
      if (!mountedRef.current) return;
      setProjects(data.projects as unknown as ProjectItem[]);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : '加载失败，请稍后重试';
      setError(message);
      setProjects([]);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    mountedRef.current = true;
    void loadProjects();
    return () => {
      mountedRef.current = false;
    };
  }, [loadProjects]);

  const handleDelete = useCallback(
    async (projectId: string, appName: string) => {
      const confirmed = window.confirm(`确定删除项目「${appName}」吗？\n删除后不可恢复。`);
      if (!confirmed) return;

      setDeletingId(projectId);
      try {
        await api.deleteProject(projectId);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } catch (err) {
        const message = err instanceof Error ? err.message : '删除失败，请重试';
        alert(message);
      } finally {
        setDeletingId(null);
      }
    },
    [],
  );

  if (loading || authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-200/40 border-t-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="sf-card p-10 text-center">
          <h2 className="sf-display text-2xl font-bold text-white">请先登录查看项目</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300">项目中心只展示登录账号下的项目，登录后可跨设备管理与导出。</p>
          <Link to="/login" className="sf-btn-primary mt-6">
            去登录
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="sf-card p-10 text-center">
          <h2 className="sf-display text-2xl font-bold text-white">加载失败</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300">{error}</p>
          <button onClick={() => void loadProjects()} className="sf-btn-primary mt-6">
            重试
          </button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="sf-card p-10 text-center">
          <h2 className="sf-display text-2xl font-bold text-white">还没有项目</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300">开始创建你的第一个 appshots 项目，AI 会帮你快速生成商店截图。</p>
          <Link to="/create" className="sf-btn-primary mt-6">
            创建新项目
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="sf-display text-2xl font-bold text-white">项目中心</h2>
          <p className="mt-1 text-sm text-slate-400">
            {user?.email} · 共 {projects.length} 个项目
          </p>
        </div>
        <Link to="/create" className="sf-btn-primary">
          新建项目
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: '项目总数', value: stats.total, tone: 'bg-white/5 text-slate-200 ring-white/10' },
          { label: '可预览项目', value: stats.ready, tone: 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/40' },
          { label: '进行中', value: stats.draft + stats.analyzing, tone: 'bg-primary-500/15 text-primary-100 ring-primary-400/40' },
        ].map((card) => (
          <div key={card.label} className="sf-card-soft flex items-center justify-between px-4 py-3">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{card.label}</span>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${card.tone}`}>{card.value}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setStatusFilter(option.id as typeof statusFilter)}
            className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition ${
              statusFilter === option.id
                ? 'bg-primary-500/20 text-primary-100 ring-1 ring-primary-400/60'
                : 'bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10'
            }`}
          >
            {option.label} · {option.count}
          </button>
        ))}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="sf-card-soft p-8 text-center">
          <p className="text-sm text-slate-300">当前筛选条件下暂无项目。</p>
          <button type="button" onClick={() => setStatusFilter('all')} className="sf-btn-ghost mt-4">
            清除筛选
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((p) => {
            const isDeleting = deletingId === p.id;
            const updatedAt = p.updatedAt || p.createdAt;
            const timestamp = new Date(updatedAt);
            const createdText = Number.isNaN(timestamp.getTime())
              ? '未知时间'
              : timestamp.toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });
            const previewTemplate = p.templateStyle ?? 'clean';
            const previewStamp = encodeURIComponent(updatedAt ?? '');
            const previewSlots = Array.from({ length: 3 });

            return (
              <article key={p.id} className="sf-card-soft group p-5 transition hover:border-primary-400/40 hover:bg-white/10">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">{p.appName}</h3>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      p.status === 'ready' || p.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-300/40'
                        : 'bg-white/10 text-slate-300 ring-1 ring-white/15'
                    }`}
                  >
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  更新于 {createdText} · {p.screenshotPaths?.length ?? 0} 张截图
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {previewSlots.map((_, i) => {
                    const hasPreview = i < (p.screenshotPaths?.length ?? 0);
                    return (
                      <PreviewTile
                        key={`${p.id}-${i}`}
                        projectId={p.id}
                        index={i}
                        hasPreview={hasPreview}
                        template={previewTemplate}
                        stamp={previewStamp}
                      />
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <Link to={`/project/${p.id}`} className="sf-btn-primary flex-1 text-center">
                    打开项目
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(p.id, p.appName)}
                    disabled={isDeleting}
                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? '删除中...' : '删除'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
