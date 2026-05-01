import { useState, useEffect, useCallback } from 'react';
import { listingService } from '@/services/listingService';
import { Listing, CreateListingRequest } from '@/types/listing';

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listingService.getAll();
      setListings(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load listings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, loading, error, refetch: fetchListings };
}

export function useCreateListing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createListing = async (dto: CreateListingRequest): Promise<Listing | null> => {
    setLoading(true);
    setError(null);
    try {
      return await listingService.create(dto);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create listing.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createListing, loading, error, clearError: () => setError(null) };
}
