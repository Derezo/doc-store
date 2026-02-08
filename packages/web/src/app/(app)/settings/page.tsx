'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth.store';
import { formatBytes } from '@/lib/utils';
import {
  User,
  HardDrive,
  Key,
  FileText,
  Loader2,
  BookOpen,
} from 'lucide-react';

interface VaultStorage {
  vaultId: string;
  name: string;
  bytes: number;
  documentCount: number;
}

interface StorageData {
  totalBytes: number;
  vaults: VaultStorage[];
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [storage, setStorage] = useState<StorageData | null>(null);
  const [loadingStorage, setLoadingStorage] = useState(true);

  const fetchStorage = useCallback(async () => {
    try {
      const data = await api
        .get('api/v1/users/me/storage')
        .json<StorageData>();
      setStorage(data);
    } catch {
      // Non-critical
    } finally {
      setLoadingStorage(false);
    }
  }, []);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage your account settings and view storage usage.
        </p>
      </div>

      {/* Profile info */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <User className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Profile
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your account information
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Display Name
            </span>
            <span className="text-sm text-zinc-900 dark:text-zinc-100">
              {user?.displayName}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Email
            </span>
            <span className="text-sm text-zinc-900 dark:text-zinc-100">
              {user?.email}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Role
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {user?.role}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Member Since
            </span>
            <span className="text-sm text-zinc-900 dark:text-zinc-100">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : '-'}
            </span>
          </div>
        </div>
      </section>

      {/* Storage usage */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <HardDrive className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Storage Usage
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Disk space used across your vaults
            </p>
          </div>
        </div>

        {loadingStorage ? (
          <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading storage info...</span>
          </div>
        ) : storage ? (
          <div className="mt-4 space-y-4">
            {/* Total */}
            <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Total Storage Used
                </span>
                <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatBytes(storage.totalBytes)}
                </span>
              </div>
            </div>

            {/* Per vault */}
            {storage.vaults.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No vaults yet. Create a vault to start storing documents.
              </p>
            ) : (
              <div className="space-y-3">
                {storage.vaults.map((vault) => (
                  <div
                    key={vault.vaultId}
                    className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {vault.name}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {formatBytes(vault.bytes)}
                      </span>
                    </div>
                    {/* Storage bar */}
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all dark:bg-blue-400"
                        style={{
                          width: `${storage.totalBytes > 0 ? Math.max((vault.bytes / storage.totalBytes) * 100, 1) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <FileText className="h-3 w-3" />
                      <span>
                        {vault.documentCount}{' '}
                        {vault.documentCount === 1 ? 'document' : 'documents'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
            Unable to load storage information.
          </p>
        )}
      </section>

      {/* Quick links */}
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Quick Links
        </h2>
        <div className="mt-4 space-y-2">
          <Link
            href="/settings/api-keys"
            className="flex items-center gap-3 rounded-lg p-3 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Key className="h-5 w-5 text-zinc-400" />
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                API Keys
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage API keys for programmatic access
              </p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}

