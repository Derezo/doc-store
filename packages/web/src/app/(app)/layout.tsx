'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useVaultStore } from '@/lib/stores/vault.store';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { SearchModal } from '@/components/search/SearchModal';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { user, isAuthenticated, logout, refresh } = useAuthStore();
  const {
    vaults,
    currentVault,
    tree,
    treeLoading,
    fetchVaults,
    fetchTree,
    setCurrentVault,
  } = useVaultStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Extract vaultId from URL params
  const vaultId = params?.vaultId as string | undefined;

  // Extract active document path from URL
  const activePath = extractDocumentPath(pathname, vaultId);

  // Whether we're in a vault context (should show sidebar)
  const isVaultContext = Boolean(vaultId);

  // Auth check
  useEffect(() => {
    if (user && !isAuthenticated) {
      refresh().then((ok) => {
        if (!ok) {
          router.push('/login');
        }
      });
    } else if (!user) {
      router.push('/login');
    }
  }, [user, isAuthenticated, refresh, router]);

  // Fetch vaults on mount
  useEffect(() => {
    if (isAuthenticated && vaults.length === 0) {
      fetchVaults();
    }
  }, [isAuthenticated, vaults.length, fetchVaults]);

  // Set current vault and fetch tree when vaultId changes
  useEffect(() => {
    if (vaultId && vaults.length > 0) {
      const vault = vaults.find((v) => v.id === vaultId) ?? null;
      setCurrentVault(vault);
      fetchTree(vaultId);
    } else if (!vaultId) {
      setCurrentVault(null);
    }
  }, [vaultId, vaults, setCurrentVault, fetchTree]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Cmd+K / Ctrl+K keyboard shortcut for search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      {/* Sidebar — only when in vault context */}
      {isVaultContext && (
        <Sidebar
          vaults={vaults}
          currentVault={currentVault}
          tree={tree}
          treeLoading={treeLoading}
          activePath={activePath}
          isOpen={sidebarOpen}
          onClose={handleCloseSidebar}
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={handleToggleSidebar}
          showSidebarToggle={isVaultContext}
          onOpenSearch={handleOpenSearch}
        />

        <main className="flex-1 overflow-y-auto">
          <div className={isVaultContext ? 'h-full' : 'mx-auto max-w-6xl px-4 py-6'}>
            {children}
          </div>
        </main>
      </div>

      {/* Search modal (Cmd+K) */}
      <SearchModal isOpen={searchOpen} onClose={handleCloseSearch} />
    </div>
  );
}

/**
 * Extract the document path from the URL pathname.
 * /vaults/abc123/folder/file.md -> folder/file.md
 */
function extractDocumentPath(
  pathname: string,
  vaultId: string | undefined,
): string | undefined {
  if (!vaultId) return undefined;

  const prefix = `/vaults/${vaultId}/`;
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    return rest || undefined;
  }

  return undefined;
}
