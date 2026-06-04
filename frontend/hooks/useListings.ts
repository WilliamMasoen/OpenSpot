import { useState, useEffect, useCallback } from 'react';
import { listingService } from '@/services/listingService';
import { Listing, CreateListingRequest } from '@/types/listing';

const PAGE_SIZE = 20;

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLng, setUserLng] = useState<number | undefined>(undefined);

  const fetchPage = useCallback(async (pageNum: number, replace: boolean, sort: string | undefined, price: number | undefined, lat: number | undefined, lng: number | undefined) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const data = await listingService.getPage(pageNum, PAGE_SIZE, sort, price, lat, lng);
      setTotalCount(data.totalCount);
      setHasMore(data.hasMore);
      setPage(pageNum);
      setListings((prev) => (replace ? data.items : [...prev, ...data.items]));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load listings.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1, true, sortBy, maxPrice, userLat, userLng);
  }, [fetchPage, sortBy, maxPrice, userLat, userLng]);

  const refetch = useCallback(() => fetchPage(1, true, sortBy, maxPrice, userLat, userLng), [fetchPage, sortBy, maxPrice, userLat, userLng]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    fetchPage(page + 1, false, sortBy, maxPrice, userLat, userLng);
  }, [hasMore, loadingMore, loading, page, fetchPage, sortBy, maxPrice, userLat, userLng]);

  const updateListing = useCallback((id: string, updates: Partial<Listing>) => {
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const setFilters = useCallback((newSortBy: string | undefined, newMaxPrice: number | undefined) => {
    setSortBy(newSortBy);
    setMaxPrice(newMaxPrice);
  }, []);

  const setLocation = useCallback((lat: number | undefined, lng: number | undefined) => {
    setUserLat(lat);
    setUserLng(lng);
  }, []);

  return { listings, totalCount, loading, loadingMore, hasMore, error, refetch, loadMore, updateListing, sortBy, maxPrice, setFilters, userLat, userLng, setLocation };
}

export function useMyListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listingService.getMine();
      setListings(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load your listings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyListings();
  }, [fetchMyListings]);

  const deleteListing = async (id: string): Promise<boolean> => {
    try {
      await listingService.delete(id);
      setListings((prev) => prev.filter((l) => l.id !== id));
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete listing.');
      return false;
    }
  };

  const toggleAvailability = useCallback(async (id: string, currentIsAvailable: boolean): Promise<void> => {
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, isAvailable: !currentIsAvailable } : l));
    try {
      await listingService.setAvailability(id, !currentIsAvailable);
    } catch {
      setListings((prev) => prev.map((l) => l.id === id ? { ...l, isAvailable: currentIsAvailable } : l));
    }
  }, []);

  return { listings, loading, error, refetch: fetchMyListings, deleteListing, toggleAvailability };
}

export function useEditListing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editListing = async (
    id: string,
    dto: UpdateListingRequest,
    newImageUris: string[] = []
  ): Promise<Listing | null> => {
    setLoading(true);
    setError(null);
    try {
      const listing = await listingService.update(id, dto);
      for (const uri of newImageUris) {
        try {
          await listingService.uploadImage(listing.id, uri);
        } catch {
          // Non-fatal: listing updated, image upload failed
        }
      }
      return listing;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update listing.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { editListing, loading, error, clearError: () => setError(null) };
}

export function useCreateListing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createListing = async (
    dto: CreateListingRequest,
    imageUris: string[] = []
  ): Promise<Listing | null> => {
    setLoading(true);
    setError(null);
    try {
      const listing = await listingService.create(dto);
      // Upload images sequentially after listing is created
      for (const uri of imageUris) {
        try {
          await listingService.uploadImage(listing.id, uri);
        } catch {
          // Non-fatal: listing created, image upload failed
        }
      }
      return listing;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create listing.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createListing, loading, error, clearError: () => setError(null) };
}

export function useFavoritesMap(
  listings: Listing[],
  updateListing: (id: string, updates: Partial<Listing>) => void,
) {
  const getFavorited = useCallback((id: string): boolean => {
    return listings.find((l) => l.id === id)?.isFavorited ?? false;
  }, [listings]);

  const toggle = useCallback(async (id: string) => {
    const current = listings.find((l) => l.id === id)?.isFavorited ?? false;
    updateListing(id, { isFavorited: !current });
    try {
      const result = await listingService.toggleFavorite(id);
      updateListing(id, { isFavorited: result.isFavorited });
    } catch {
      updateListing(id, { isFavorited: current });
    }
  }, [listings, updateListing]);

  return { getFavorited, toggle };
}

export function useMyFavorites() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listingService.getFavorites();
      setListings(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load favorites.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

  const removeFavorite = useCallback(async (id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
    try {
      await listingService.toggleFavorite(id);
    } catch {
      fetchFavorites(); // re-fetch to restore state if API fails
    }
  }, [fetchFavorites]);

  return { listings, loading, error, refetch: fetchFavorites, removeFavorite };
}
