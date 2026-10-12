import { create } from 'zustand';
import { authApi, setupApi } from '@/services/api';
import type { User } from '@nommable/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  needsSetup: boolean;
  login: (username: string, password: string) => Promise<void>;
  registerWithInvite: (token: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User) => void;
  setAuthFromSetup: (user: User, token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,
  needsSetup: false,

  login: async (username, password) => {
    const response = await authApi.login({ username, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    set({ user, token, needsSetup: false });
  },

  registerWithInvite: async (token, username, password) => {
    const response = await authApi.registerWithInvite({ token, username, password });
    const { token: authToken, user } = response.data;
    localStorage.setItem('token', authToken);
    set({ user, token: authToken, needsSetup: false });
  },

  logout: async () => {
    const token = localStorage.getItem('token');
    // Tell the backend to revoke the session (best effort)
    if (token) {
      try {
        await authApi.logout();
      } catch {
        // Session may already be invalid — still clear local state
      }
    }
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    try {
      const setupRes = await setupApi.getStatus();
      if (setupRes.data.needsSetup) {
        localStorage.removeItem('token');
        set({ needsSetup: true, user: null, token: null, isLoading: false });
        return;
      }
    } catch {
      // If status check fails, proceed with normal auth check
    }

    const token = localStorage.getItem('token');
    if (!token) {
      set({ needsSetup: false, isLoading: false });
      return;
    }

    try {
      const response = await authApi.me();
      set({ user: response.data, needsSetup: false, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, needsSetup: false, isLoading: false });
    }
  },

  setUser: (user: User) => {
    set({ user });
  },

  setAuthFromSetup: (user: User, token: string) => {
    if (token) {
      localStorage.setItem('token', token);
    }
    set({ user, token, needsSetup: false, isLoading: false });
  },
}));
