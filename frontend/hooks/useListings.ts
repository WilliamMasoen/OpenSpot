import { useState, useEffect, useCallback, useRef } from 'react';
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

  const fetchPage = useCallback(async (pageNum: number, replace: boolean) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const data = await listingService.getPage(pageNum, PAGE_SIZE);
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
    fetchPage(1, true);
  }, [fetchPage]);

  const refetch = useCallback(() => fetchPage(1, true), [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    fetchPage(page + 1, false);
  }, [hasMore, loadingMore, loading, page, fetchPage]);

  return { listings, totalCount, loading, loadingMore, hasMore, error, refetch, loadMore };
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

  return { listings, loading, error, refetch: fetchMyListings, deleteListing };
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

// Manages optimistic favorite state for a list of listings.
export function useFavoritesMap(listings: Listing[]) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  const getFavorited = useCallback((id: string): boolean => {
    if (id in pendingRef.current) return pendingRef.current[id];
    return listings.find((l) => l.id === id)?.isFavorited ?? false;
  }, [listings]);

  const toggle = useCallback(async (id: string) => {
    const current = id in pendingRef.current
      ? pendingRef.current[id]
      : (listings.find((l) => l.id === id)?.isFavorited ?? false);
    const next = !current;
    setPending((prev) => ({ ...prev, [id]: next }));
    try {
      const result = await listingService.toggleFavorite(id);
      setPending((prev) => ({ ...prev, [id]: result.isFavorited }));
    } catch {
      setPending((prev) => ({ ...prev, [id]: current }));
    }
  }, [listings]);

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
