'use client';

import { useState, useEffect } from 'react';
import { useVaultStore } from '@/lib/stores/vault.store';
import { Settings, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VaultSettingsProps {
  vaultId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Settings dialog for vault configuration.
 * Allows setting the base directory to treat a subdirectory as the vault root.
 */
export function VaultSettings({ vaultId, isOpen, onClose }: VaultSettingsProps) {
  const { currentVault, tree, updateVault, fetchTree } = useVaultStore();
  const [selectedBaseDir, setSelectedBaseDir] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize selected base dir from current vault
  useEffect(() => {
    if (isOpen && currentVault) {
      setSelectedBaseDir(currentVault.baseDir);
    }
  }, [isOpen, currentVault]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !currentVault) return null;

  // Get top-level directories from tree
  const topLevelDirs = (tree ?? [])
    .filter((node) => node.type === 'directory')
    .map((node) => node.name);

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      await updateVault(vaultId, { baseDir: selectedBaseDir });
      await fetchTree(vaultId);
      toast.success('Vault settings updated');
      onClose();
    } catch (err: any) {
      const body = await err?.response?.json?.().catch(() => ({}));
      toast.error(body?.message ?? 'Failed to update vault settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const hasChanges = selectedBaseDir !== currentVault.baseDir;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-zinc-400" />
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Vault Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Vault info */}
          <div>
            <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {currentVault.name}
            </h4>
            {currentVault.description && (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {currentVault.description}
              </p>
            )}
          </div>

          {/* Base directory setting */}
          <div>
            <label htmlFor="base-dir-select" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Base Directory
            </label>
            <select
              id="base-dir-select"
              value={selectedBaseDir ?? ''}
              onChange={(e) => setSelectedBaseDir(e.target.value || null)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            >
              <option value="">None (show all files)</option>
              {topLevelDirs.map((dir) => (
                <option key={dir} value={dir}>
                  {dir}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Set a base directory to treat a subdirectory as the vault root. Files outside the base directory will appear dimmed.
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              This is useful when syncing with Remotely Save, which creates a subfolder matching your Obsidian vault name.
            </p>
          </div>

          {/* Current setting display */}
          {currentVault.baseDir && (
            <div className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Current base directory: <span className="font-mono font-medium">{currentVault.baseDir}</span>
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isUpdating || !hasChanges}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VaultSettings;
