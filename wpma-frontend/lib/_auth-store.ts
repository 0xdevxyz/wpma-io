'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from './api';
import { toast } from 'react-hot-toast';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  planType: string;
  siteCount: number;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: any) => Promise<boolean>;
  logout: () => void;
  loadUser: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        if (typeof window === 'undefined') return false;
        set({ isLoading: true });

        try {
          const response = await authApi.login(email, password);
          if (response.success && response.data) {
            const { user, token } = response.data;

            set({ user, token, isAuthenticated: true, isLoading: false });
            localStorage.setItem('token', token);
            toast.success('Anmeldung erfolgreich!');
            return true;
          } else {
            set({ isLoading: false });
            toast.error(response.error || 'Anmeldung fehlgeschlagen');
            return false;
          }
        } catch {
          set({ isLoading: false });
          toast.error('Anmeldung fehlgeschlagen');
          return false;
        }
      },

      register: async (userData) => {
        if (typeof window === 'undefined') return false;
        set({ isLoading: true });

        try {
          const response = await authApi.register(userData);
          if (response.success && response.data) {
            const { user, token } = response.data;

            set({ user, token, isAuthenticated: true, isLoading: false });
            localStorage.setItem('token', token);
            toast.success('Registrierung erfolgreich!');
            return true;
          } else {
            set({ isLoading: false });
            toast.error(response.error || 'Registrierung fehlgeschlagen');
            return false;
          }
        } catch {
          set({ isLoading: false });
          toast.error('Registrierung fehlgeschlagen');
          return false;
        }
      },

      logout: () => {
        if (typeof window === 'undefined') return;

        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        localStorage.removeItem('token');
        toast.success('Erfolgreich abgemeldet');
      },

      loadUser: async () => {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('token');
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        set({ isLoading: true });

        try {
          const response = await authApi.me();
          if (response.success && response.data) {
            set({ user: response.data, token, isAuthenticated: true, isLoading: false });
          } else {
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
            localStorage.removeItem('token');
          }
        } catch {
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
          localStorage.removeItem('token');
        }
      },

      refreshToken: async () => {
        if (typeof window === 'undefined') return;

        try {
          const response = await authApi.refreshToken();
          if (response.success && response.data) {
            const { user, token } = response.data;
            set({ user, token });
            localStorage.setItem('token', token);
          }
        } catch (error) {
          console.error('Token-Erneuerung fehlgeschlagen:', error);
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
