// frontend/src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { login as apiLogin, register as apiRegister, getMe } from '../utils/api';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await apiLogin({ email, password });
          localStorage.setItem('propos_token', data.token);
          set({ user: data.user, token: data.token, isLoading: false });
          return true;
        } catch (err) {
          set({ error: err.response?.data?.error || 'Login failed', isLoading: false });
          return false;
        }
      },

      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await apiRegister(payload);
          localStorage.setItem('propos_token', data.token);
          set({ user: data.user, token: data.token, isLoading: false });
          return true;
        } catch (err) {
          set({ error: err.response?.data?.error || 'Registration failed', isLoading: false });
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem('propos_token');
        set({ user: null, token: null });
      },

      refreshUser: async () => {
        try {
          const { data } = await getMe();
          set({ user: data });
        } catch {
          localStorage.removeItem('propos_token');
          set({ user: null, token: null });
        }
      },
    }),
    { name: 'propos-auth', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
);
