import { apiClient } from './apiClient';
import { UserProfile as PublicUserProfile, ConversationBuyer } from '@/types/user';

export interface MeProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  profileImageUrl?: string | null;
}

export interface UpdateProfileDto {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export const userService = {
  getMe: () => apiClient.get<MeProfile>('/api/users/me'),
  updateMe: (dto: UpdateProfileDto) => apiClient.put<MeProfile>('/api/users/me', dto),
  savePushToken: (token: string) => apiClient.post<void>('/api/users/push-token', { token }),
  deletePushToken: (token: string) => apiClient.delete<void>('/api/users/push-token', { token }),
  getProfile: (userId: string) => apiClient.get<PublicUserProfile>(`/api/users/${userId}/profile`),

  async uploadPhoto(uri: string): Promise<{ url: string }> {
    const { useAuthStore } = await import('@/store/authStore');
    const token = useAuthStore.getState().accessToken;
    const form = new FormData();
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    form.append('file', { uri, name: filename, type: mimeType } as unknown as Blob);

    const { BASE_URL } = await import('./apiClient');
    const res = await fetch(`${BASE_URL}/api/users/me/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error('Failed to upload photo.');
    return res.json();
  },

  getConversationBuyers: (listingId: string) =>
    apiClient.get<ConversationBuyer[]>(`/api/listings/${listingId}/conversation-buyers`),

  createSale: (listingId: string, buyerId: string) =>
    apiClient.post<{ saleId: string }>(`/api/listings/${listingId}/sale`, { buyerId }),
};
