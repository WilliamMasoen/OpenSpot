import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { TokenResponse, AuthUser } from '@/types/auth';

export const REFRESH_TOKEN_KEY = 'openspot_refresh_token';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (tokenResponse: TokenResponse) => Promise<void>;
  clearAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (tokenResponse) => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResponse.refreshToken);
    set({
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      user: {
        userId: tokenResponse.userId,
        email: tokenResponse.email,
        roles: tokenResponse.roles,
      },
      isAuthenticated: true,
    });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
}));
