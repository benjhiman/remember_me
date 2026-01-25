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
  authReady: boolean; // Indicates auth store is fully hydrated and ready
  setTokens: (accessToken: string, refreshToken: string, user: User) => void;
  setTempToken: (tempToken: string) => void;
  clearAuth: () => void;
  updateAccessToken: (accessToken: string) => void;
  setAuthReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      tempToken: null,
      authReady: false,
      setTokens: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, tempToken: null }),
      setTempToken: (tempToken) => set({ tempToken }),
      clearAuth: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          tempToken: null,
          authReady: false,
        }),
      updateAccessToken: (accessToken) => set({ accessToken }),
      setAuthReady: (ready: boolean) => set({ authReady: ready }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist auth data, not authReady (it's runtime state)
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        tempToken: state.tempToken,
      }),
    }
  )
);
