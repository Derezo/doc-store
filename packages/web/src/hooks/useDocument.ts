'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Document } from '@doc-store/shared';
import { api } from '@/lib/api-client';

interface UseDocumentResult {
  document: Document | null;
  content: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that fetches document content and metadata by vault ID and path.
 */
export function useDocument(
  vaultId: string | undefined,
  path: string | undefined,
): UseDocumentResult {
  const [document, setDocument] = useState<Document | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocument = useCallback(async () => {
    if (!vaultId || !path) return;

    setLoading(true);
    setError(null);

    try {
      const data = await api
        .get(`api/v1/vaults/${vaultId}/documents/${path}`)
        .json<{ document: Document; content: string }>();

      setDocument(data.document);
      setContent(data.content);
    } catch (err: any) {
      const body = await err?.response?.json?.().catch(() => ({}));
      setError(body?.message ?? 'Failed to load document');
      setDocument(null);
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, [vaultId, path]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  return {
    document,
    content,
    loading,
    error,
    refetch: fetchDocument,
  };
}
