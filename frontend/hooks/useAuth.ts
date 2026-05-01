import { useState } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';
import { LoginRequest, RegisterRequest } from '@/types/auth';

export function useAuth() {
  const { user, isAuthenticated, setAuth, clearAuth, refreshToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (dto: LoginRequest) => {
    setLoading(true);
    setError(null);
    try {
      const tokenResponse = await authService.login(dto);
      await setAuth(tokenResponse);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const register = async (dto: RegisterRequest) => {
    setLoading(true);
    setError(null);
    try {
      const tokenResponse = await authService.register(dto);
      await setAuth(tokenResponse);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // Clear local state even if server call fails
    } finally {
      await clearAuth();
      router.replace('/(auth)/login');
    }
  };

  const forgotPassword = async (email: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(email);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send reset email.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    isAuthenticated,
    loading,
    error,
    clearError: () => setError(null),
    login,
    register,
    logout,
    forgotPassword,
  };
}
