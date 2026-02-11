import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

interface AdminProject {
  id: string;
  appName: string;
  status: string;
  templateStyle: string;
  screenshotCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  projectCount: number;
  projects: AdminProject[];
}

const STORAGE_KEY = 'appshots_admin_key';

function formatTime(value?: string | null): string {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Admin() {
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);

  useEffect(() => {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (cached) {
      setAdminKey(cached);
      setAdminKeyInput(cached);
    }
  }, []);

  const totalProjects = useMemo(
    () => users.reduce((sum, user) => sum + (user.projectCount || user.projects.length), 0),
    [users],
  );

  const loadUsers = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.adminListUsers(adminKey);
      setUsers((response.users as unknown as AdminUser[]) || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加载失败');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSaveKey = () => {
    const next = adminKeyInput.trim();
    if (!next) return;
    window.localStorage.setItem(STORAGE_KEY, next);
    setAdminKey(next);
  };

  const handleClearKey = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAdminKey(null);
    setUsers([]);
    setError(null);
  };

  const handleDeleteProject = async (projectId: string, appName: string) => {
    if (!adminKey) return;
    const confirmed = window.confirm(`确定删除项目「${appName}」吗？此操作不可恢复。`);
    if (!confirmed) return;

    setBusyTarget(`project:${projectId}`);
    try {
      await api.adminDeleteProject(adminKey, projectId);
      await loadUsers();
    } catch (requestError) {
      alert(requestError instanceof Error ? requestError.message : '删除失败');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleDeleteUser = async (userId: string, email: string, projectCount: number) => {
    if (!adminKey) return;
    const confirmed = window.confirm(
      `确定删除用户「${email}」吗？\n将同时删除该用户的 ${projectCount} 个项目，且不可恢复。`,
    );
    if (!confirmed) return;

    setBusyTarget(`user:${userId}`);
    try {
      await api.adminDeleteUser(adminKey, userId);
      await loadUsers();
    } catch (requestError) {
      alert(requestError instanceof Error ? requestError.message : '删除失败');
    } finally {
      setBusyTarget(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sf-display text-2xl font-bold text-white">管理后台</h1>
          <p className="mt-1 text-sm text-slate-400">查看用户与项目，并执行删除操作（高风险，请谨慎）。</p>
        </div>
      </div>

      <div className="sf-card-soft mb-6 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Admin Key</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={adminKeyInput}
            onChange={(event) => setAdminKeyInput(event.target.value)}
            type="password"
            className="sf-input max-w-md"
            placeholder="输入 ADMIN_KEY"
          />
          <button type="button" onClick={handleSaveKey} className="sf-btn-primary px-4 py-2">
            保存并加载
          </button>
          <button type="button" onClick={handleClearKey} className="sf-btn-ghost px-4 py-2">
            清除
          </button>
          <button type="button" onClick={() => void loadUsers()} className="sf-btn-ghost px-4 py-2" disabled={!adminKey || loading}>
            刷新
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-200">{error}</p>}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">用户数</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-100">{users.length}</span>
        </div>
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">项目数</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-100">{totalProjects}</span>
        </div>
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">状态</span>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-100">{loading ? '加载中' : '就绪'}</span>
        </div>
      </div>

      <div className="space-y-4">
        {users.map((user) => {
          const deletingUser = busyTarget === `user:${user.id}`;
          return (
            <article key={user.id} className="sf-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">{user.email}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    用户ID：{user.id} · 创建：{formatTime(user.createdAt)} · 更新：{formatTime(user.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200">
                    项目 {user.projectCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDeleteUser(user.id, user.email, user.projectCount)}
                    disabled={deletingUser}
                    className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {deletingUser ? '删除中...' : '删除用户'}
                  </button>
                </div>
              </div>

              {user.projects.length > 0 ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-200">
                    <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">项目</th>
                        <th className="py-2 pr-4">状态</th>
                        <th className="py-2 pr-4">模板</th>
                        <th className="py-2 pr-4">截图</th>
                        <th className="py-2 pr-4">更新时间</th>
                        <th className="py-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.projects.map((project) => {
                        const deletingProject = busyTarget === `project:${project.id}`;
                        return (
                          <tr key={project.id} className="border-t border-white/10 text-sm text-slate-300">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-slate-100">{project.appName}</p>
                              <p className="text-[11px] text-slate-500">{project.id}</p>
                            </td>
                            <td className="py-3 pr-4">{project.status}</td>
                            <td className="py-3 pr-4">{project.templateStyle}</td>
                            <td className="py-3 pr-4">{project.screenshotCount}</td>
                            <td className="py-3 pr-4">{formatTime(project.updatedAt)}</td>
                            <td className="py-3">
                              <button
                                type="button"
                                onClick={() => void handleDeleteProject(project.id, project.appName)}
                                disabled={deletingProject}
                                className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-100 transition hover:bg-rose-500/20 disabled:opacity-50"
                              >
                                {deletingProject ? '删除中...' : '删除项目'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">该用户暂无项目。</p>
              )}
            </article>
          );
        })}

        {!loading && users.length === 0 && (
          <div className="sf-card-soft p-8 text-center text-slate-300">暂无数据。请先输入正确 ADMIN_KEY 后加载。</div>
        )}
      </div>
    </div>
  );
}
