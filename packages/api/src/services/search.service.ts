import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import type { SearchResult, SearchResponse } from '@doc-store/shared';

interface SearchOptions {
  query: string;
  userId: string;
  vaultId?: string;
  tags?: string[];
  limit: number;
  offset: number;
  /** If the caller is an API key scoped to a vault, restrict to that vault. */
  apiKeyVaultId?: string | null;
}

/**
 * Full-text search across all documents the user has access to.
 * Uses PostgreSQL tsvector with websearch_to_tsquery for natural search syntax.
 */
export async function search(options: SearchOptions): Promise<SearchResponse> {
  const { query, userId, limit, offset } = options;

  // Determine effective vault filter: API key vault scope takes precedence
  const effectiveVaultId = options.apiKeyVaultId ?? options.vaultId ?? null;

  // Build tag filter array
  const tagsFilter = options.tags && options.tags.length > 0 ? options.tags : null;

  // Use raw SQL for complex full-text search query with count(*) OVER() window function
  const results = await db.execute<{
    document_id: string;
    vault_id: string;
    vault_name: string;
    path: string;
    title: string | null;
    tags: string[] | null;
    file_modified_at: string;
    snippet: string;
    rank: number;
    total_count: string;
  }>(sql`
    SELECT
      d.id as document_id,
      d.vault_id,
      v.name as vault_name,
      d.path,
      d.title,
      d.tags,
      d.file_modified_at,
      ts_headline('english', COALESCE(d.stripped_content, ''), query,
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') as snippet,
      ts_rank_cd(d.content_tsv, query) as rank,
      count(*) OVER() as total_count
    FROM documents d
    JOIN vaults v ON v.id = d.vault_id
    CROSS JOIN websearch_to_tsquery('english', ${query}) query
    WHERE d.content_tsv @@ query
      AND v.user_id = ${userId}
      AND (${effectiveVaultId}::uuid IS NULL OR v.id = ${effectiveVaultId}::uuid)
      AND (${tagsFilter}::text[] IS NULL OR d.tags @> ${tagsFilter}::text[])
    ORDER BY rank DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const rows = results.rows ?? results;

  const searchResults: SearchResult[] = (rows as any[]).map((row) => ({
    documentId: row.document_id,
    vaultId: row.vault_id,
    vaultName: row.vault_name,
    path: row.path,
    title: row.title,
    snippet: row.snippet ?? '',
    tags: (row.tags as string[]) ?? [],
    rank: Number(row.rank),
    fileModifiedAt: row.file_modified_at instanceof Date
      ? row.file_modified_at.toISOString()
      : String(row.file_modified_at),
  }));

  const total = (rows as any[]).length > 0
    ? Number((rows as any[])[0].total_count)
    : 0;

  return {
    results: searchResults,
    total,
    query,
  };
}
