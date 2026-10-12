import { create } from 'zustand';
import { authApi } from '@/services/api';
import type { User } from '@nommable/shared';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  registerWithInvite: (token: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: true,

  login: async (username, password) => {
    const response = await authApi.login({ username, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    set({ user, token });
  },

  registerWithInvite: async (token, username, password) => {
    const response = await authApi.registerWithInvite({ token, username, password });
    const { token: authToken, user } = response.data;
    localStorage.setItem('token', authToken);
    set({ user, token: authToken });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const response = await authApi.me();
      set({ user: response.data, isLoading: false });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, token: null, isLoading: false });
    }
  },

  setUser: (user: User) => {
    set({ user });
  },
}));
