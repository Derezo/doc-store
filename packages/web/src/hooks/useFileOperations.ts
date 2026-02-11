'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { useVaultStore } from '@/lib/stores/vault.store';
import type {
  MoveDocumentRequest,
  CopyDocumentRequest,
  CreateDirectoryRequest,
} from '@doc-store/shared';

interface UseFileOperationsOptions {
  vaultId: string;
  onSuccess?: () => void;
}

/**
 * Hook for file operations (move, copy, delete, create directory, rename).
 * Automatically refreshes the tree and shows toast notifications.
 */
export function useFileOperations({ vaultId, onSuccess }: UseFileOperationsOptions) {
  const router = useRouter();
  const { fetchTree } = useVaultStore();

  const refreshTree = useCallback(async () => {
    await fetchTree(vaultId);
    onSuccess?.();
  }, [vaultId, fetchTree, onSuccess]);

  const moveItem = useCallback(
    async (sourcePath: string, destination: string, overwrite = false) => {
      try {
        const body: MoveDocumentRequest = { destination, overwrite };
        await api.post(`api/v1/vaults/${vaultId}/documents/${sourcePath}/move`, {
          json: body,
        });

        toast.success('Item moved successfully');
        await refreshTree();
        return true;
      } catch (err: any) {
        const body = await err?.response?.json?.().catch(() => ({}));
        toast.error(body?.message ?? 'Failed to move item');
        return false;
      }
    },
    [vaultId, refreshTree],
  );

  const copyItem = useCallback(
    async (sourcePath: string, destination: string, overwrite = false) => {
      try {
        const body: CopyDocumentRequest = { destination, overwrite };
        await api.post(`api/v1/vaults/${vaultId}/documents/${sourcePath}/copy`, {
          json: body,
        });

        toast.success('Item copied successfully');
        await refreshTree();
        return true;
      } catch (err: any) {
        const body = await err?.response?.json?.().catch(() => ({}));
        toast.error(body?.message ?? 'Failed to copy item');
        return false;
      }
    },
    [vaultId, refreshTree],
  );

  const deleteItem = useCallback(
    async (path: string) => {
      try {
        await api.delete(`api/v1/vaults/${vaultId}/documents/${path}`);

        toast.success('Item deleted successfully');
        await refreshTree();
        return true;
      } catch (err: any) {
        const body = await err?.response?.json?.().catch(() => ({}));
        toast.error(body?.message ?? 'Failed to delete item');
        return false;
      }
    },
    [vaultId, refreshTree],
  );

  const createDirectory = useCallback(
    async (dirPath: string) => {
      try {
        const body: CreateDirectoryRequest = { path: dirPath };
        await api.post(`api/v1/vaults/${vaultId}/documents/directories`, {
          json: body,
        });

        toast.success('Directory created successfully');
        await refreshTree();
        return true;
      } catch (err: any) {
        const body = await err?.response?.json?.().catch(() => ({}));
        toast.error(body?.message ?? 'Failed to create directory');
        return false;
      }
    },
    [vaultId, refreshTree],
  );

  const renameItem = useCallback(
    async (currentPath: string, newName: string, isFile: boolean) => {
      // Compute new path: same parent directory + new name
      const pathParts = currentPath.split('/');
      pathParts[pathParts.length - 1] = newName;

      // For files, ensure .md extension
      if (isFile && !newName.endsWith('.md')) {
        pathParts[pathParts.length - 1] = newName + '.md';
      }

      const destination = pathParts.join('/');

      const success = await moveItem(currentPath, destination, false);
      return success ? destination : null;
    },
    [moveItem],
  );

  return {
    moveItem,
    copyItem,
    deleteItem,
    createDirectory,
    renameItem,
  };
}
