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
  imageUrls: string[];
}

export interface CreateListingRequest {
  title: string;
  description: string;
  address: string;
  price: number;
  startDate: string;
  endDate: string;
}

export interface UpdateListingRequest extends CreateListingRequest {
  isAvailable: boolean;
}
