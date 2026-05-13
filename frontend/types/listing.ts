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
  imageUrls: string[];
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
