import { create } from 'zustand';
import type { User } from '@appshots/shared';
import { api } from '../api/client';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;

  initialize: () => Promise<void>;
  sendCode: (email: string) => Promise<{ devCode?: string }>;
  verifyCode: (email: string, code: string) => Promise<{ migratedProjectCount: number }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  initialize: async () => {
    set({ status: 'loading' });
    try {
      const { user } = await api.getMe();
      if (user) {
        set({ user, status: 'authenticated' });
      } else {
        set({ user: null, status: 'unauthenticated' });
      }
    } catch {
      set({ user: null, status: 'unauthenticated' });
    }
  },

  sendCode: async (email: string) => {
    set({ error: null });
    try {
      const res = await api.sendCode(email);
      return { devCode: res.devCode };
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送验证码失败';
      set({ error: message });
      throw err;
    }
  },

  verifyCode: async (email: string, code: string) => {
    set({ error: null });
    try {
      const res = await api.verifyCode(email, code);
      set({ user: res.user, status: 'authenticated' });
      return { migratedProjectCount: res.migratedProjectCount };
    } catch (err) {
      const message = err instanceof Error ? err.message : '验证失败';
      set({ error: message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } finally {
      set({ user: null, status: 'unauthenticated', error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
