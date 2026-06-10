import { apiClient } from './apiClient';
import { Rating, PendingRating } from '@/types/user';

export const ratingService = {
  create: (saleId: string, stars: number, comment?: string) =>
    apiClient.post<Rating>('/api/ratings', { saleId, stars, comment }),

  getPending: () => apiClient.get<PendingRating[]>('/api/ratings/pending'),

  getUserRatings: (userId: string) =>
    apiClient.get<Rating[]>(`/api/ratings/user/${userId}`),
};
