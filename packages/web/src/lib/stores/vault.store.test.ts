import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Vault, TreeNode } from '@doc-store/shared';

// Mock api-client with a factory function
vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Import after mock
import { useVaultStore } from './vault.store';
import { api } from '@/lib/api-client';

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;

const mockVault: Vault = {
  id: 'vault-1',
  name: 'Test Vault',
  slug: 'test-vault',
  description: 'A test vault',
  userId: 'user-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const mockTree: TreeNode[] = [
  {
    name: 'notes',
    type: 'directory',
    path: 'notes',
    children: [
      {
        name: 'hello.md',
        type: 'file',
        path: 'notes/hello.md',
      },
    ],
  },
];

describe('vaultStore', () => {
  beforeEach(() => {
    // Reset store state
    useVaultStore.setState({
      vaults: [],
      currentVault: null,
      tree: null,
      loading: false,
      treeLoading: false,
    });
    vi.clearAllMocks();
  });

  describe('fetchVaults', () => {
    it('calls API and updates vaults list', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue({ vaults: [mockVault] }),
      });

      await useVaultStore.getState().fetchVaults();

      expect(mockGet).toHaveBeenCalledWith('api/v1/vaults');
      expect(useVaultStore.getState().vaults).toEqual([mockVault]);
      expect(useVaultStore.getState().loading).toBe(false);
    });

    it('sets loading state during fetch', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockImplementation(() => {
          expect(useVaultStore.getState().loading).toBe(true);
          return Promise.resolve({ vaults: [] });
        }),
      });

      await useVaultStore.getState().fetchVaults();
    });

    it('handles API errors gracefully', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      await useVaultStore.getState().fetchVaults();

      expect(useVaultStore.getState().loading).toBe(false);
      expect(useVaultStore.getState().vaults).toEqual([]);
    });
  });

  describe('createVault', () => {
    it('calls API and adds vault to list', async () => {
      mockPost.mockReturnValue({
        json: vi.fn().mockResolvedValue({ vault: mockVault }),
      });

      const result = await useVaultStore.getState().createVault('Test Vault', 'Description');

      expect(mockPost).toHaveBeenCalledWith('api/v1/vaults', {
        json: { name: 'Test Vault', description: 'Description' },
      });
      expect(result).toEqual(mockVault);
      expect(useVaultStore.getState().vaults).toContain(mockVault);
    });

    it('omits description if not provided', async () => {
      mockPost.mockReturnValue({
        json: vi.fn().mockResolvedValue({ vault: mockVault }),
      });

      await useVaultStore.getState().createVault('Test Vault');

      expect(mockPost).toHaveBeenCalledWith('api/v1/vaults', {
        json: { name: 'Test Vault' },
      });
    });
  });

  describe('fetchTree', () => {
    it('calls API and updates tree', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockResolvedValue({ tree: mockTree }),
      });

      await useVaultStore.getState().fetchTree('vault-1');

      expect(mockGet).toHaveBeenCalledWith('api/v1/vaults/vault-1/tree');
      expect(useVaultStore.getState().tree).toEqual(mockTree);
      expect(useVaultStore.getState().treeLoading).toBe(false);
    });

    it('handles API errors by setting tree to null', async () => {
      mockGet.mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Not found')),
      });

      await useVaultStore.getState().fetchTree('vault-1');

      expect(useVaultStore.getState().tree).toBeNull();
      expect(useVaultStore.getState().treeLoading).toBe(false);
    });
  });

  describe('clearTree', () => {
    it('resets tree to null', () => {
      useVaultStore.setState({ tree: mockTree });

      useVaultStore.getState().clearTree();

      expect(useVaultStore.getState().tree).toBeNull();
    });
  });
});
