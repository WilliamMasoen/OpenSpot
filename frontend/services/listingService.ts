import { apiClient } from './apiClient';
import { useAuthStore } from '@/store/authStore';
import { Listing, PagedResult, CreateListingRequest, UpdateListingRequest } from '@/types/listing';
import Constants from 'expo-constants';

function getBaseUrl(): string {
  if (!__DEV__) return 'https://api.openspot.app';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:5137` : 'http://localhost:5137';
}

export const listingService = {
  getPage: (page: number, pageSize = 20) =>
    apiClient.get<PagedResult<Listing>>(`/api/listings?page=${page}&pageSize=${pageSize}`),

  getById: (id: string) =>
    apiClient.get<Listing>(`/api/listings/${id}`),

  getMine: () =>
    apiClient.get<Listing[]>('/api/listings/mine'),

  create: (dto: CreateListingRequest) =>
    apiClient.post<Listing>('/api/listings', dto),

  update: (id: string, dto: UpdateListingRequest) =>
    apiClient.put<Listing>(`/api/listings/${id}`, dto),

  delete: (id: string) =>
    apiClient.delete<void>(`/api/listings/${id}`),

  toggleFavorite: (id: string) =>
    apiClient.post<{ isFavorited: boolean }>(`/api/listings/${id}/favorite`),

  getFavorites: () =>
    apiClient.get<Listing[]>('/api/listings/favorites'),

  search: (params: { q?: string; lat?: number; lng?: number; radius?: number }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.lat != null) qs.set('lat', params.lat.toString());
    if (params.lng != null) qs.set('lng', params.lng.toString());
    if (params.radius != null) qs.set('radius', params.radius.toString());
    return apiClient.get<Listing[]>(`/api/listings/search?${qs.toString()}`);
  },

  uploadImage: async (listingId: string, imageUri: string): Promise<{ url: string }> => {
    const token = useAuthStore.getState().accessToken;
    const filename = imageUri.split('/').pop() ?? 'image.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', { uri: imageUri, name: filename, type: mimeType } as any);

    const response = await fetch(`${getBaseUrl()}/api/listings/${listingId}/images`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Image upload failed.');
    }

    return response.json();
  },
};
