'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { useVaultStore } from '@/lib/stores/vault.store';
import { FilePlus, Loader2, X } from 'lucide-react';

interface NewFileDialogProps {
  vaultId: string;
  /** Pre-fill the directory path (e.g., "notes/") */
  defaultDir?: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Dialog for creating a new Markdown file in a vault.
 * Creates the file via PUT with empty or template content.
 */
export function NewFileDialog({
  vaultId,
  defaultDir = '',
  isOpen,
  onClose,
}: NewFileDialogProps) {
  const router = useRouter();
  const { fetchTree } = useVaultStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setFileName('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleCreate = useCallback(async () => {
    let name = fileName.trim();
    if (!name) {
      setError('File name is required');
      return;
    }

    // Auto-append .md extension if not present
    if (!name.endsWith('.md') && !name.endsWith('.MD')) {
      name = name + '.md';
    }

    // Build full path
    const fullPath = defaultDir ? `${defaultDir}${name}` : name;

    // Validate: no double slashes, no leading slash, no ..
    if (fullPath.includes('..') || fullPath.startsWith('/') || fullPath.includes('//')) {
      setError('Invalid file path');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await api.put(`api/v1/vaults/${vaultId}/documents/${fullPath}`, {
        json: {
          content: `# ${name.replace(/\.md$/i, '')}\n\n`,
        },
      });

      // Refresh tree
      fetchTree(vaultId);

      // Navigate to the new document
      router.push(`/vaults/${vaultId}/${fullPath}`);
      onClose();
    } catch (err: any) {
      const body = await err?.response?.json?.().catch(() => ({}));
      setError(body?.message ?? 'Failed to create file');
    } finally {
      setIsCreating(false);
    }
  }, [fileName, defaultDir, vaultId, router, fetchTree, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FilePlus className="h-5 w-5 text-zinc-400" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              New file
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          {defaultDir && (
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Creating in: <span className="font-mono">{defaultDir}</span>
            </p>
          )}

          <label htmlFor="new-file-name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            File name
          </label>
          <input
            ref={inputRef}
            id="new-file-name"
            type="text"
            value={fileName}
            onChange={(e) => {
              setFileName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="my-document.md"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            .md extension will be added automatically if omitted.
            You can include path separators (e.g., &ldquo;notes/my-file&rdquo;).
          </p>

          {error && (
            <p className="mt-2 text-xs text-red-500">{error}</p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !fileName.trim()}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Create</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewFileDialog;
