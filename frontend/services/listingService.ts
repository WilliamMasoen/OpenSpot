import { apiClient } from './apiClient';
import { Listing, CreateListingRequest, UpdateListingRequest } from '@/types/listing';

export const listingService = {
  getAll: () =>
    apiClient.get<Listing[]>('/api/listings'),

  getById: (id: string) =>
    apiClient.get<Listing>(`/api/listings/${id}`),

  create: (dto: CreateListingRequest) =>
    apiClient.post<Listing>('/api/listings', dto),

  update: (id: string, dto: UpdateListingRequest) =>
    apiClient.put<Listing>(`/api/listings/${id}`, dto),

  delete: (id: string) =>
    apiClient.delete<void>(`/api/listings/${id}`),
};
