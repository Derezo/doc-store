'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, X, Loader2 } from 'lucide-react';
import { useSearch } from '@/hooks/useSearch';
import { sanitizeSnippet } from '@/lib/utils';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Cmd+K search modal with live results, keyboard navigation, and snippet highlighting.
 */
export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { results, total, loading, error } = useSearch(query, {
    limit: 10,
    debounceMs: 300,
  });

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Delay focus to ensure the modal is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const items = resultsRef.current.querySelectorAll('[data-search-result]');
      const item = items[selectedIndex];
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const navigateToResult = useCallback(
    (index: number) => {
      const result = results[index];
      if (result) {
        onClose();
        router.push(`/vaults/${result.vaultId}/${result.path}`);
      }
    },
    [results, onClose, router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results.length > 0) {
            navigateToResult(selectedIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results.length, selectedIndex, navigateToResult, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative mx-auto mt-[15vh] max-w-2xl px-4">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-700">
            <Search className="h-5 w-5 shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search documents..."
              className="flex-1 bg-transparent py-3.5 text-base text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              autoComplete="off"
              spellCheck={false}
            />
            {loading && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
            )}
            <button
              onClick={onClose}
              className="shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div
            ref={resultsRef}
            className="max-h-[60vh] overflow-y-auto"
          >
            {error && (
              <div className="px-4 py-8 text-center text-sm text-red-500">
                {error}
              </div>
            )}

            {!error && query.trim() && !loading && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}

            {!error && results.length > 0 && (
              <ul className="py-2">
                {results.map((result, index) => (
                  <li key={result.documentId}>
                    <button
                      data-search-result
                      onClick={() => navigateToResult(index)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        index === selectedIndex
                          ? 'bg-blue-50 dark:bg-blue-950/50'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <FileText
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          index === selectedIndex
                            ? 'text-blue-500'
                            : 'text-zinc-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        {/* Title and vault */}
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {result.title ?? result.path.split('/').pop()}
                          </span>
                          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                            {result.vaultName}
                          </span>
                        </div>
                        {/* Path */}
                        <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {result.path}
                        </div>
                        {/* Snippet with highlighting */}
                        {result.snippet && (
                          <div
                            className="mt-1 line-clamp-2 text-xs text-zinc-600 dark:text-zinc-400 [&_mark]:rounded [&_mark]:bg-yellow-200 [&_mark]:px-0.5 [&_mark]:text-zinc-900 dark:[&_mark]:bg-yellow-800 dark:[&_mark]:text-yellow-100"
                            dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.snippet) }}
                          />
                        )}
                        {/* Tags */}
                        {result.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {result.tags.slice(0, 5).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!error && !query.trim() && (
              <div className="px-4 py-8 text-center text-sm text-zinc-400">
                Type to search across all your documents
              </div>
            )}
          </div>

          {/* Footer */}
          {results.length > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 dark:border-zinc-700">
              <span className="text-xs text-zinc-400">
                {total} result{total !== 1 ? 's' : ''} found
              </span>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono dark:border-zinc-600 dark:bg-zinc-800">
                  &uarr;&darr;
                </kbd>
                <span>navigate</span>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono dark:border-zinc-600 dark:bg-zinc-800">
                  &crarr;
                </kbd>
                <span>open</span>
                <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1 py-0.5 font-mono dark:border-zinc-600 dark:bg-zinc-800">
                  esc
                </kbd>
                <span>close</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
