import { useState, useCallback } from 'react';
import { listingService } from '@/services/listingService';
import { Listing } from '@/types/listing';

export interface SearchParams {
  q?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

export function useSearch() {
  const [results, setResults] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (params: SearchParams) => {
    if (!params.q?.trim() && params.lat == null) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await listingService.search(params);
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Search failed.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setHasSearched(false);
    setError(null);
  }, []);

  const updateListing = useCallback((id: string, updates: Partial<Listing>) => {
    setResults((prev) => prev.map((l) => l.id === id ? { ...l, ...updates } : l));
  }, []);

  return { results, loading, error, hasSearched, search, clear, updateListing };
}
