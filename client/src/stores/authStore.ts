import { create } from 'zustand';
import type { User, MembershipInfo } from '@appshots/shared';
import { api } from '../api/client';

interface AuthState {
  user: User | null;
  membership: MembershipInfo | null;
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
  membership: null,
  status: 'idle',
  error: null,

  initialize: async () => {
    set({ status: 'loading' });
    try {
      const { user, membership } = await api.getMe();
      if (user) {
        set({ user, membership, status: 'authenticated' });
      } else {
        set({ user: null, membership: null, status: 'unauthenticated' });
      }
    } catch {
      set({ user: null, membership: null, status: 'unauthenticated' });
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
      set({ user: res.user, membership: res.membership, status: 'authenticated' });
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
      set({ user: null, membership: null, status: 'unauthenticated', error: null });
    }
  },

  clearError: () => set({ error: null }),
}));
