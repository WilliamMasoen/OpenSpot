import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { TokenResponse, AuthUser } from '@/types/auth';

export const REFRESH_TOKEN_KEY = 'openspot_refresh_token';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasSeenOnboarding: boolean;
  setAuth: (tokenResponse: TokenResponse) => Promise<void>;
  clearAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<Pick<AuthUser, 'firstName' | 'lastName' | 'profileImageUrl'>>) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  hasSeenOnboarding: false,

  setAuth: async (tokenResponse) => {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokenResponse.refreshToken);
    set({
      accessToken: tokenResponse.accessToken,
      user: {
        userId: tokenResponse.userId,
        email: tokenResponse.email,
        firstName: tokenResponse.firstName,
        lastName: tokenResponse.lastName,
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
      isAuthenticated: false,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setHasSeenOnboarding: (seen) => set({ hasSeenOnboarding: seen }),

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : state.user,
    })),
}));
