export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  address: string;
  price: number;
  startDate: string;
  endDate: string;
  isAvailable: boolean;
  createdAt: string;
  ownerId: string;
  latitude?: number | null;
  longitude?: number | null;
  isFavorited?: boolean | null;
  imageUrls: string[];
  ownerName: string;
  ownerProfileImageUrl?: string | null;
  ownerAverageRating?: number | null;
  ownerTotalRatings: number;
}

export interface CreateListingRequest {
  title: string;
  description: string;
  address: string;
  price: number;
  startDate: string;
  endDate: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateListingRequest extends CreateListingRequest {
  isAvailable: boolean;
}
