'use client';

import { useVaultStore } from '@/lib/stores/vault.store';

/**
 * Hook that provides current vault context from the store.
 * The app layout handles all vault/tree data fetching based on URL params.
 * This hook is a convenience wrapper to access that data.
 */
export function useVault(_vaultId?: string) {
  const vaults = useVaultStore((s) => s.vaults);
  const currentVault = useVaultStore((s) => s.currentVault);
  const tree = useVaultStore((s) => s.tree);
  const treeLoading = useVaultStore((s) => s.treeLoading);
  const loading = useVaultStore((s) => s.loading);

  return {
    vaults,
    currentVault,
    tree,
    treeLoading,
    loading,
  };
}
