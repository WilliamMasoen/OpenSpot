import { apiClient } from './apiClient';
import { LoginRequest, RegisterRequest, TokenResponse } from '@/types/auth';

export const authService = {
  register: (dto: RegisterRequest) =>
    apiClient.post<TokenResponse>('/api/auth/register', dto),

  login: (dto: LoginRequest) =>
    apiClient.post<TokenResponse>('/api/auth/login', dto),

  refresh: (refreshToken: string) =>
    apiClient.post<TokenResponse>('/api/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    apiClient.post<void>('/api/auth/logout', { refreshToken }),

  forgotPassword: (email: string) =>
    apiClient.post<void>('/api/auth/forgot-password', { email }),
};
