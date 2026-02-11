import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const navigate = useNavigate();
  const { status, error, sendCode, verifyCode, clearError } = useAuthStore();

  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/history', { replace: true });
    }
  }, [status, navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [countdown]);

  const handleSendCode = useCallback(async () => {
    if (!email.trim()) return;
    setSending(true);
    clearError();
    try {
      const result = await sendCode(email.trim());
      setDevCode(result.devCode);
      setPhase('code');
      setCode('');
      setCountdown(60);
    } catch {
      // error is set in store
    } finally {
      setSending(false);
    }
  }, [email, sendCode, clearError]);

  const handleVerify = useCallback(async () => {
    if (!code.trim()) return;
    setVerifying(true);
    try {
      await verifyCode(email.trim(), code.trim());
      navigate('/history', { replace: true });
    } catch {
      // error is set in store
    } finally {
      setVerifying(false);
    }
  }, [email, code, verifyCode, navigate]);

  const handleResend = useCallback(async () => {
    if (countdown > 0) return;
    setSending(true);
    clearError();
    try {
      const result = await sendCode(email.trim());
      setDevCode(result.devCode);
      setCountdown(60);
    } catch {
      // error is set in store
    } finally {
      setSending(false);
    }
  }, [email, countdown, sendCode, clearError]);

  const handleBackToEmail = () => {
    setPhase('email');
    setCode('');
    setDevCode(undefined);
    clearError();
  };

  return (
    <div className="mx-auto mt-20 max-w-md px-4">
      <div className="sf-card p-8">
        <h1 className="sf-display mb-2 text-2xl font-bold text-white">登录 / 注册</h1>
        <p className="mb-6 text-sm text-slate-400">
          输入邮箱获取验证码，新用户将自动注册。
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400 ring-1 ring-red-500/30">
            {error}
          </div>
        )}

        {devCode && phase === 'code' && (
          <div className="mb-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400 ring-1 ring-amber-500/30">
            开发模式验证码: <span className="font-mono font-bold">{devCode}</span>
          </div>
        )}

        {phase === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendCode();
            }}
          >
            <label className="sf-label mb-1 block">邮箱地址</label>
            <input
              type="email"
              className="sf-input mb-4 w-full"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
            <button
              type="submit"
              className="sf-btn-primary w-full"
              disabled={sending || !email.trim()}
            >
              {sending ? '发送中...' : '获取验证码'}
            </button>
          </form>
        ) : (
          <div>
            <p className="mb-4 text-sm text-slate-300">
              验证码已发送至 <span className="font-medium text-white">{email}</span>
            </p>

            <label className="sf-label mb-1 block">验证码</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="sf-input mb-4 w-full text-center text-2xl tracking-[0.5em]"
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setCode(val);
              }}
              autoFocus
            />

            <button
              type="button"
              className="sf-btn-primary mb-3 w-full"
              disabled={verifying || code.length !== 6}
              onClick={handleVerify}
            >
              {verifying ? '验证中...' : '登录'}
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="sf-btn-ghost text-sm"
                onClick={handleBackToEmail}
              >
                更换邮箱
              </button>
              <button
                type="button"
                className="sf-btn-ghost text-sm"
                disabled={countdown > 0 || sending}
                onClick={handleResend}
              >
                {countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
