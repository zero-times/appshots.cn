import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const NAV_ITEMS = [
  { to: '/create', label: '开始制作' },
  { to: '/history', label: '项目中心' },
  { to: '/admin', label: '管理后台' },
] as const;

export function Header() {
  const location = useLocation();
  const { user, status, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-[0_6px_30px_rgba(4,6,12,0.5)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="group inline-flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary-300/50 bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-black text-white shadow-glow">
            SF
          </span>
          <span>
            <span className="sf-display block text-base font-semibold tracking-tight text-white">appshots</span>
            <span className="block text-[11px] uppercase tracking-[0.2em] text-slate-400">AI App Screenshot Studio</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-primary-500/20 text-primary-100 ring-1 ring-primary-400/40'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-2 border-l border-white/10 pl-4">
            {status === 'authenticated' && user ? (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/20 text-sm font-bold text-primary-200 ring-1 ring-primary-400/40">
                  {user.email[0].toUpperCase()}
                </div>
                <span className="hidden text-sm text-slate-300 sm:inline">{user.email}</span>
                <button
                  onClick={() => logout()}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  退出
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  location.pathname === '/login'
                    ? 'bg-primary-500/20 text-primary-100 ring-1 ring-primary-400/40'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
