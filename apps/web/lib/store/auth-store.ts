import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  tempToken: string | null;
  setTokens: (accessToken: string, refreshToken: string, user: User) => void;
  setTempToken: (tempToken: string) => void;
  clearAuth: () => void;
  updateAccessToken: (accessToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      tempToken: null,
      setTokens: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, tempToken: null }),
      setTempToken: (tempToken) => set({ tempToken }),
      clearAuth: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          tempToken: null,
        }),
      updateAccessToken: (accessToken) => set({ accessToken }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
