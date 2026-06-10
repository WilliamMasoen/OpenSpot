import { Listing } from './listing';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string | null;
  averageRating?: number | null;
  totalRatings: number;
  memberSince: string;
  listingCount: number;
  recentRatings: Rating[];
  listings: Listing[];
}

export interface Rating {
  id: string;
  saleId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerProfileImageUrl?: string | null;
  stars: number;
  comment?: string | null;
  createdAt: string;
}

export interface PendingRating {
  saleId: string;
  listingId: string;
  listingTitle: string;
  revieweeId: string;
  revieweeName: string;
  revieweeProfileImageUrl?: string | null;
}

export interface ConversationBuyer {
  id: string;
  name: string;
  profileImageUrl?: string | null;
}
