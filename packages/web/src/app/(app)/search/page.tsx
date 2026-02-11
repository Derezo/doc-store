'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, FileText, ChevronRight, Loader2, Tag } from 'lucide-react';
import { sanitizeSnippet } from '@/lib/utils';
import { useSearch } from '@/hooks/useSearch';
import { useVaultStore } from '@/lib/stores/vault.store';

/**
 * Full search page at /search with query parameter support.
 * Supports vault filtering, tag filtering, and pagination.
 */
export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [selectedVault, setSelectedVault] = useState<string | undefined>(
    searchParams.get('vault') ?? undefined,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    const tagsParam = searchParams.get('tags');
    return tagsParam ? tagsParam.split(',').filter(Boolean) : [];
  });

  const { vaults } = useVaultStore();
  const { results, total, loading, error, search } = useSearch(query, {
    vaultId: selectedVault,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    limit: 20,
    debounceMs: 300,
  });

  // Update URL params when search changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedVault) params.set('vault', selectedVault);
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    window.history.replaceState(null, '', `/search${newUrl}`);
  }, [query, selectedVault, selectedTags]);

  const handleLoadMore = () => {
    search(query, results.length);
  };

  const hasMore = results.length < total;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Search header */}
      <div className="mb-6">
        <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Search Documents
        </h1>

        {/* Search input */}
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <Search className="h-5 w-5 shrink-0 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all your documents..."
            className="flex-1 bg-transparent text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            autoComplete="off"
            autoFocus
          />
          {loading && (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-400" />
          )}
        </div>

        {/* Filters row */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Vault filter */}
          <select
            value={selectedVault ?? ''}
            onChange={(e) => setSelectedVault(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            <option value="">All vaults</option>
            {vaults.map((vault) => (
              <option key={vault.id} value={vault.id}>
                {vault.name}
              </option>
            ))}
          </select>

          {/* Active tag filters */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() =>
                    setSelectedTags((prev) => prev.filter((t) => t !== tag))
                  }
                  className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-800/50"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                  <span className="ml-0.5">&times;</span>
                </button>
              ))}
              <button
                onClick={() => setSelectedTags([])}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Clear tags
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {!error && query.trim() && !loading && results.length === 0 && (
        <div className="py-12 text-center">
          <Search className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">
            No results found for &ldquo;{query}&rdquo;
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Try using different keywords, or check your spelling
          </p>
        </div>
      )}

      {!error && results.length > 0 && (
        <>
          <div className="mb-3 text-sm text-zinc-500">
            {total} result{total !== 1 ? 's' : ''} found
          </div>

          <div className="space-y-1">
            {results.map((result) => (
              <Link
                key={result.documentId}
                href={`/vaults/${result.vaultId}/${result.path}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
              >
                {/* Vault and path breadcrumb */}
                <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium">{result.vaultName}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{result.path}</span>
                </div>

                {/* Title */}
                <div className="mt-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {result.title ?? result.path.split('/').pop()}
                  </span>
                </div>

                {/* Snippet */}
                {result.snippet && (
                  <div
                    className="mt-2 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400 [&_mark]:rounded [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:text-zinc-900 dark:[&_mark]:bg-yellow-800 dark:[&_mark]:text-yellow-100"
                    dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }}
                  />
                )}

                {/* Tags and date row */}
                <div className="mt-2 flex items-center gap-2">
                  {result.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.tags.slice(0, 5).map((tag) => (
                        <button
                          key={tag}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!selectedTags.includes(tag)) {
                              setSelectedTags((prev) => [...prev, tag]);
                            }
                          }}
                          className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-zinc-400">
                    {new Date(result.fileModifiedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </span>
                ) : (
                  `Load more (${results.length} of ${total})`
                )}
              </button>
            </div>
          )}
        </>
      )}

      {!error && !query.trim() && (
        <div className="py-12 text-center">
          <Search className="mx-auto h-12 w-12 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">
            Enter a search query to find documents
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Supports natural search syntax: &ldquo;exact phrase&rdquo;, OR, -excluded
          </p>
        </div>
      )}
    </div>
  );
}
