'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { ApiKeyMeta, CreateApiKeyResponse } from '@doc-store/shared';

interface VaultOption {
  id: string;
  name: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyMeta[]>([]);
  const [vaults, setVaults] = useState<VaultOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createScopes, setCreateScopes] = useState<string[]>(['read', 'write']);
  const [createVaultId, setCreateVaultId] = useState('');
  const [createExpiresAt, setCreateExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);

  // Newly created key modal
  const [newKeyData, setNewKeyData] = useState<CreateApiKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const data = await api.get('api/v1/api-keys').json<{ apiKeys: ApiKeyMeta[] }>();
      setApiKeys(data.apiKeys);
    } catch {
      setError('Failed to load API keys');
    }
  }, []);

  const fetchVaults = useCallback(async () => {
    try {
      const data = await api.get('api/v1/vaults').json<{ vaults: VaultOption[] }>();
      setVaults(data.vaults);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchKeys(), fetchVaults()]).finally(() => setLoading(false));
  }, [fetchKeys, fetchVaults]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const body: Record<string, any> = {
        name: createName,
        scopes: createScopes,
      };
      if (createVaultId) body.vaultId = createVaultId;
      if (createExpiresAt) body.expiresAt = new Date(createExpiresAt).toISOString();

      const data = await api
        .post('api/v1/api-keys', { json: body })
        .json<CreateApiKeyResponse>();

      setNewKeyData(data);
      setShowCreate(false);
      setCreateName('');
      setCreateScopes(['read', 'write']);
      setCreateVaultId('');
      setCreateExpiresAt('');
      await fetchKeys();
    } catch (err: any) {
      const body = await err?.response?.json?.().catch(() => ({}));
      setError(body?.message ?? 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await api.patch(`api/v1/api-keys/${keyId}`, {
        json: { isActive: false },
      });
      await fetchKeys();
    } catch {
      setError('Failed to revoke API key');
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm('Are you sure you want to permanently delete this API key?')) {
      return;
    }
    try {
      await api.delete(`api/v1/api-keys/${keyId}`);
      await fetchKeys();
    } catch {
      setError('Failed to delete API key');
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setCreateScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-foreground/60">Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Manage API keys for programmatic access to your vaults and documents.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {showCreate ? 'Cancel' : 'Create API Key'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700 dark:border-red-600 dark:bg-red-950 dark:text-red-300">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* New Key Modal */}
      {newKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg border border-foreground/10 bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">API Key Created</h2>
            <p className="mt-2 text-sm text-foreground/60">
              Copy your API key now. You will not be able to see it again.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-foreground/20 bg-foreground/5 px-3 py-2 text-sm font-mono">
                {newKeyData.fullKey}
              </code>
              <button
                onClick={() => handleCopy(newKeyData.fullKey)}
                className="shrink-0 rounded border border-foreground/20 px-3 py-2 text-sm transition-colors hover:bg-foreground/5"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setNewKeyData(null);
                  setCopied(false);
                }}
                className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-lg border border-foreground/10 p-4"
        >
          <h2 className="text-lg font-semibold">Create New API Key</h2>

          <div>
            <label htmlFor="keyName" className="mb-1 block text-sm font-medium">
              Name
            </label>
            <input
              id="keyName"
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g., Obsidian Sync, CI/CD Pipeline"
              required
              maxLength={100}
              className="w-full rounded border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Scopes</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createScopes.includes('read')}
                  onChange={() => toggleScope('read')}
                  className="rounded"
                />
                Read
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createScopes.includes('write')}
                  onChange={() => toggleScope('write')}
                  className="rounded"
                />
                Write
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="vaultRestriction" className="mb-1 block text-sm font-medium">
              Vault Restriction (optional)
            </label>
            <select
              id="vaultRestriction"
              value={createVaultId}
              onChange={(e) => setCreateVaultId(e.target.value)}
              className="w-full rounded border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            >
              <option value="">All vaults</option>
              {vaults.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="expiresAt" className="mb-1 block text-sm font-medium">
              Expiration (optional)
            </label>
            <input
              id="expiresAt"
              type="datetime-local"
              value={createExpiresAt}
              onChange={(e) => setCreateExpiresAt(e.target.value)}
              className="w-full rounded border border-foreground/20 bg-background px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={creating || createScopes.length === 0}
            className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Key'}
          </button>
        </form>
      )}

      {/* Keys List */}
      {apiKeys.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 p-8 text-center">
          <p className="text-sm text-foreground/60">
            No API keys yet. Create one to get started with programmatic access.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-foreground/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10 bg-foreground/5">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Key Prefix</th>
                <th className="px-4 py-3 text-left font-medium">Scopes</th>
                <th className="px-4 py-3 text-left font-medium">Vault</th>
                <th className="px-4 py-3 text-left font-medium">Last Used</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr
                  key={key.id}
                  className="border-b border-foreground/5 last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{key.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-foreground/5 px-1.5 py-0.5 text-xs font-mono">
                      ds_k_{key.keyPrefix}...
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground/60">
                    {key.vaultId
                      ? vaults.find((v) => v.id === key.vaultId)?.name ?? 'Restricted'
                      : 'All'}
                  </td>
                  <td className="px-4 py-3 text-foreground/60">
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    {key.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">
                        Revoked
                      </span>
                    )}
                    {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                        Expired
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {key.isActive && (
                        <button
                          onClick={() => handleRevoke(key.id)}
                          className="text-xs text-foreground/60 transition-colors hover:text-foreground"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(key.id)}
                        className="text-xs text-red-500 transition-colors hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
