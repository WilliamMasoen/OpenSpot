import { apiClient } from './apiClient';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
}

export interface UpdateProfileDto {
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export const userService = {
  getMe: () => apiClient.get<UserProfile>('/api/users/me'),
  updateMe: (dto: UpdateProfileDto) => apiClient.put<UserProfile>('/api/users/me', dto),
  savePushToken: (token: string) => apiClient.post<void>('/api/users/push-token', { token }),
  deletePushToken: (token: string) => apiClient.delete<void>('/api/users/push-token', { token }),
};
