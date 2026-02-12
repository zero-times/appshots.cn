import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { MembershipWechatCard } from '../components/common/MembershipWechatCard';
import { membershipWechatLabel } from '../constants/membership';

interface AdminProject {
  id: string;
  appName: string;
  status: string;
  templateStyle: string;
  screenshotCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AdminMembershipInfo {
  status: 'active';
  activatedAt?: string;
  expiresAt?: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  membership: AdminMembershipInfo | null;
  analysisCountToday: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  projectCount: number;
  projects: AdminProject[];
}

interface AdminMemberRecord {
  id: string;
  userId: string;
  status: 'active' | 'expired' | 'revoked';
  activatedAt?: string | null;
  expiresAt?: string | null;
  note?: string | null;
  user?: {
    id: string;
    email: string;
    role: 'user' | 'admin';
  } | null;
}

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
  const authStatus = useAuthStore((s) => s.status);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'admin';
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<AdminMemberRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyTarget, setBusyTarget] = useState<string | null>(null);
  const [expiresAtByUser, setExpiresAtByUser] = useState<Record<string, string>>({});

  const totalProjects = useMemo(
    () => users.reduce((sum, user) => sum + (user.projectCount || user.projects.length), 0),
    [users],
  );
  const adminCount = useMemo(() => users.filter((user) => user.role === 'admin').length, [users]);
  const memberCount = useMemo(
    () => users.filter((user) => user.membership?.status === 'active').length,
    [users],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userRes, memberRes] = await Promise.all([
        api.adminListUsers('__cookie__'),
        api.adminListMembers('__cookie__'),
      ]);
      setUsers((userRes.users as unknown as AdminUser[]) || []);
      setMembers((memberRes.members as unknown as AdminMemberRecord[]) || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '加载失败');
      setUsers([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void loadData();
  }, [isAdmin, loadData]);

  const handleSetRole = async (user: AdminUser, role: 'user' | 'admin') => {
    if (user.role === role) return;
    if (user.id === currentUser?.id && role === 'user') {
      alert('不能移除自己的管理员权限。');
      return;
    }
    const confirmed = window.confirm(
      role === 'admin'
        ? `确定将 ${user.email} 设为管理员吗？`
        : `确定取消 ${user.email} 的管理员权限吗？`,
    );
    if (!confirmed) return;

    setBusyTarget(`role:${user.id}`);
    try {
      await api.adminSetRole('__cookie__', user.id, role);
      await loadData();
    } catch (requestError) {
      alert(requestError instanceof Error ? requestError.message : '操作失败');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleMembership = async (user: AdminUser, action: 'activate' | 'revoke') => {
    const expiresAt = expiresAtByUser[user.id]?.trim();
    const message =
      action === 'activate'
        ? `确认开通 ${user.email} 的会员吗？`
        : `确认撤销 ${user.email} 的会员吗？`;
    if (!window.confirm(message)) return;

    setBusyTarget(`membership:${user.id}:${action}`);
    try {
      await api.adminSetMembership('__cookie__', user.id, action, action === 'activate' ? expiresAt || null : null);
      await loadData();
    } catch (requestError) {
      alert(requestError instanceof Error ? requestError.message : '操作失败');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleQuickActivate30d = (userId: string) => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const datePart = expiresAt.toISOString().slice(0, 16);
    setExpiresAtByUser((prev) => ({ ...prev, [userId]: datePart }));
  };

  const handleDeleteProject = async (projectId: string, appName: string) => {
    const confirmed = window.confirm(`确定删除项目「${appName}」吗？此操作不可恢复。`);
    if (!confirmed) return;

    setBusyTarget(`project:${projectId}`);
    try {
      await api.adminDeleteProject('__cookie__', projectId);
      await loadData();
    } catch (requestError) {
      alert(requestError instanceof Error ? requestError.message : '删除失败');
    } finally {
      setBusyTarget(null);
    }
  };

  const handleDeleteUser = async (userId: string, email: string, projectCount: number) => {
    const confirmed = window.confirm(
      `确定删除用户「${email}」吗？\n将同时删除该用户的 ${projectCount} 个项目，且不可恢复。`,
    );
    if (!confirmed) return;

    setBusyTarget(`user:${userId}`);
    try {
      await api.adminDeleteUser('__cookie__', userId);
      await loadData();
    } catch (requestError) {
      alert(requestError instanceof Error ? requestError.message : '删除失败');
    } finally {
      setBusyTarget(null);
    }
  };

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary-200/30 border-t-primary-500" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="sf-card p-10 text-center">
          <h2 className="sf-display text-2xl font-bold text-white">请先登录管理员账号</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300">管理后台仅对管理员开放。</p>
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

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="sf-card p-10 text-center">
          <h2 className="sf-display text-2xl font-bold text-white">无权限访问管理后台</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-300">
            当前账号不是管理员。如需开通会员或管理权限，请联系 {membershipWechatLabel()}。
          </p>
          <div className="mx-auto mt-6 w-fit">
            <MembershipWechatCard compact />
          </div>
          <Link to="/" className="sf-btn-primary mt-6">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="sf-display text-2xl font-bold text-white">管理后台</h1>
          <p className="mt-1 text-sm text-slate-400">管理用户角色、会员状态和项目数据（高风险操作，请谨慎）。</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="sf-btn-ghost px-4 py-2" disabled={loading}>
          刷新数据
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">用户数</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-100">{users.length}</span>
        </div>
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">管理员</span>
          <span className="rounded-full bg-primary-500/20 px-3 py-1 text-sm text-primary-100">{adminCount}</span>
        </div>
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">会员</span>
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-100">{memberCount}</span>
        </div>
        <div className="sf-card-soft flex items-center justify-between px-4 py-3">
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">项目总数</span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-100">{totalProjects}</span>
        </div>
      </div>

      {members.length > 0 && (
        <div className="sf-card-soft mb-6 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Active Members</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {members.map((member) => (
              <span key={member.id} className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                {member.user?.email ?? member.userId}
                {member.expiresAt ? ` · 到期 ${formatTime(member.expiresAt)}` : ' · 永久'}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {users.map((user) => {
          const deletingUser = busyTarget === `user:${user.id}`;
          const changingRole = busyTarget === `role:${user.id}`;
          const activatingMembership = busyTarget === `membership:${user.id}:activate`;
          const revokingMembership = busyTarget === `membership:${user.id}:revoke`;
          const isMember = user.membership?.status === 'active';
          return (
            <article key={user.id} className="sf-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">{user.email}</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    用户ID：{user.id} · 创建：{formatTime(user.createdAt)} · 更新：{formatTime(user.updatedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`rounded-full px-2.5 py-1 ${
                        user.role === 'admin'
                          ? 'border border-primary-300/40 bg-primary-500/15 text-primary-100'
                          : 'border border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      角色：{user.role}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 ${
                        isMember
                          ? 'border border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
                          : 'border border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      会员：{isMember ? '已开通' : '未开通'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
                      今日分析：{user.analysisCountToday ?? 0}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSetRole(user, user.role === 'admin' ? 'user' : 'admin')}
                    disabled={changingRole}
                    className="rounded-lg border border-primary-300/30 bg-primary-500/10 px-3 py-2 text-sm text-primary-100 transition hover:bg-primary-500/20 disabled:opacity-50"
                  >
                    {changingRole ? '更新中...' : user.role === 'admin' ? '取消管理员' : '设为管理员'}
                  </button>
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

              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={expiresAtByUser[user.id] || ''}
                    onChange={(event) =>
                      setExpiresAtByUser((prev) => ({
                        ...prev,
                        [user.id]: event.target.value,
                      }))
                    }
                    className="sf-input w-[220px]"
                    placeholder="会员到期时间（留空为永久）"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickActivate30d(user.id)}
                    className="sf-btn-ghost px-3 py-2 text-xs"
                  >
                    快速填充 +30 天
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMembership(user, 'activate')}
                    disabled={activatingMembership}
                    className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {activatingMembership ? '处理中...' : '开通/续期会员'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMembership(user, 'revoke')}
                    disabled={revokingMembership}
                    className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 transition hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    {revokingMembership ? '处理中...' : '撤销会员'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  当前会员状态：
                  {isMember
                    ? `已开通（${user.membership?.expiresAt ? `到期 ${formatTime(user.membership.expiresAt)}` : '永久'}）`
                    : '未开通'}
                </p>
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
          <div className="sf-card-soft p-8 text-center text-slate-300">暂无数据。</div>
        )}
      </div>
    </div>
  );
}
