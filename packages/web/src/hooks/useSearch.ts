'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SearchResult, SearchResponse } from '@doc-store/shared';
import { api } from '@/lib/api-client';

interface UseSearchOptions {
  vaultId?: string;
  tags?: string[];
  limit?: number;
  debounceMs?: number;
}

interface UseSearchResult {
  results: SearchResult[];
  total: number;
  loading: boolean;
  error: string | null;
  search: (_query: string, _offset?: number) => Promise<void>;
}

/**
 * Hook for debounced full-text search against the API.
 * Automatically debounces the query string and fetches results.
 */
export function useSearch(
  query: string,
  options: UseSearchOptions = {},
): UseSearchResult {
  const { vaultId, tags, limit = 20, debounceMs = 300 } = options;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = useCallback(
    async (q: string, offset = 0) => {
      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      if (!q.trim()) {
        setResults([]);
        setTotal(0);
        setLoading(false);
        setError(null);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams({
          q,
          limit: String(limit),
          offset: String(offset),
        });

        if (vaultId) {
          searchParams.set('vault', vaultId);
        }

        if (tags && tags.length > 0) {
          searchParams.set('tags', tags.join(','));
        }

        const data = await api
          .get(`api/v1/search?${searchParams.toString()}`, {
            signal: controller.signal,
          })
          .json<SearchResponse>();

        if (!controller.signal.aborted) {
          if (offset > 0) {
            // Append for "load more"
            setResults((prev) => [...prev, ...data.results]);
          } else {
            setResults(data.results);
          }
          setTotal(data.total);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        const body = await err?.response?.json?.().catch(() => ({}));
        if (!controller.signal.aborted) {
          setError(body?.message ?? 'Search failed');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [limit, vaultId, tags],
  );

  // Debounced effect for query changes
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    timerRef.current = setTimeout(() => {
      executeSearch(query);
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, debounceMs, executeSearch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    results,
    total,
    loading,
    error,
    search: executeSearch,
  };
}
