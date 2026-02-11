import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary-600/20 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-60px] h-[320px] w-[320px] rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-grid opacity-[0.16]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pb-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
