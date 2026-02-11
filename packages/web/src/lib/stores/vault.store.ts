'use client';

import { create } from 'zustand';
import type { Vault, TreeNode } from '@doc-store/shared';
import { api } from '../api-client';

interface VaultState {
  vaults: Vault[];
  currentVault: Vault | null;
  tree: TreeNode[] | null;
  loading: boolean;
  treeLoading: boolean;

  fetchVaults: () => Promise<void>;
  setCurrentVault: (_vault: Vault | null) => void;
  fetchTree: (_vaultId: string) => Promise<void>;
  createVault: (_name: string, _description?: string) => Promise<Vault>;
  updateVault: (_vaultId: string, _data: { name?: string; description?: string | null; baseDir?: string | null }) => Promise<Vault>;
  clearTree: () => void;
}

export const useVaultStore = create<VaultState>((set, _get) => ({
  vaults: [],
  currentVault: null,
  tree: null,
  loading: false,
  treeLoading: false,

  fetchVaults: async () => {
    set({ loading: true });
    try {
      const data = await api.get('api/v1/vaults').json<{ vaults: Vault[] }>();
      set({ vaults: data.vaults, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setCurrentVault: (vault: Vault | null) => {
    set({ currentVault: vault });
  },

  fetchTree: async (vaultId: string) => {
    set({ treeLoading: true });
    try {
      const data = await api
        .get(`api/v1/vaults/${vaultId}/tree`)
        .json<{ tree: TreeNode[] }>();
      set({ tree: data.tree, treeLoading: false });
    } catch {
      set({ tree: null, treeLoading: false });
    }
  },

  createVault: async (name: string, description?: string) => {
    const body: Record<string, string> = { name };
    if (description) body.description = description;

    const data = await api
      .post('api/v1/vaults', { json: body })
      .json<{ vault: Vault }>();

    const vault = data.vault;
    set((state) => ({ vaults: [...state.vaults, vault] }));
    return vault;
  },

  updateVault: async (vaultId: string, data: { name?: string; description?: string | null; baseDir?: string | null }) => {
    const result = await api
      .patch(`api/v1/vaults/${vaultId}`, { json: data })
      .json<{ vault: Vault }>();

    set((state) => ({
      vaults: state.vaults.map((v) => v.id === vaultId ? result.vault : v),
      currentVault: state.currentVault?.id === vaultId ? result.vault : state.currentVault,
    }));

    return result.vault;
  },

  clearTree: () => {
    set({ tree: null });
  },
}));
