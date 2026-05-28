import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useAuthStore, REFRESH_TOKEN_KEY } from '@/store/authStore';
import { TokenResponse } from '@/types/auth';

function getBaseUrl(): string {
  if (!__DEV__) return 'https://api.openspot.app';
  // On a physical device, hostUri is the dev machine's IP (e.g. "192.168.1.5:8081").
  // Strip the port and point at the backend instead.
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:5137` : 'http://localhost:5137';
}

const BASE_URL = getBaseUrl();

let _refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return null;

    const tokenResponse: TokenResponse = await response.json();
    await useAuthStore.getState().setAuth(tokenResponse);
    return tokenResponse.accessToken;
  })().finally(() => { _refreshPromise = null; });
  return _refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  let response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    const newToken = await tryRefresh();
    if (!newToken) {
      useAuthStore.getState().clearAuth();
      throw new Error('Session expired. Please log in again.');
    }
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
    });
  }

  if (response.status === 204) return undefined as T;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
