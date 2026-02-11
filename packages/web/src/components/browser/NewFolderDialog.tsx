'use client';

import { useState, useRef, useEffect } from 'react';
import { FolderPlus, Loader2, X } from 'lucide-react';

export interface NewFolderDialogProps {
  isOpen: boolean;
  parentPath: string;
  onConfirm: (folderName: string) => void;
  onClose: () => void;
}

/**
 * Dialog for creating a new folder.
 * Validates name and computes full path.
 */
export function NewFolderDialog({
  isOpen,
  parentPath,
  onConfirm,
  onClose,
}: NewFolderDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setFolderName('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleCreate = async () => {
    const name = folderName.trim();

    if (!name) {
      setError('Folder name is required');
      return;
    }

    // Validate: no slashes, no leading dot, not empty
    if (name.includes('/') || name.includes('\\')) {
      setError('Folder name cannot contain slashes');
      return;
    }

    if (name.startsWith('.')) {
      setError('Folder name cannot start with a dot');
      return;
    }

    if (name.includes('..')) {
      setError('Invalid folder name');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Compute full path
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      await onConfirm(fullPath);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-zinc-400" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              New folder
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
          {parentPath && (
            <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
              Creating in: <span className="font-mono">{parentPath}/</span>
            </p>
          )}

          <label
            htmlFor="folder-name"
            className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Folder name
          </label>
          <input
            ref={inputRef}
            id="folder-name"
            type="text"
            value={folderName}
            onChange={(e) => {
              setFolderName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="my-folder"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
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
            disabled={isCreating || !folderName.trim()}
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
