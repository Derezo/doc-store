'use client';

import { useEffect } from 'react';
import type { Vault, TreeNode } from '@doc-store/shared';
import { VaultSwitcher } from './VaultSwitcher';
import { FileTree } from '@/components/browser/FileTree';
import { X, Loader2 } from 'lucide-react';

interface SidebarProps {
  vaults: Vault[];
  currentVault: Vault | null;
  tree: TreeNode[] | null;
  treeLoading: boolean;
  activePath?: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Collapsible sidebar with vault switcher and file tree.
 * On desktop: persistent side panel.
 * On mobile: overlay with backdrop.
 */
export function Sidebar({
  vaults,
  currentVault,
  tree,
  treeLoading,
  activePath,
  isOpen,
  onClose,
}: SidebarProps) {
  // Close sidebar on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-zinc-200 bg-zinc-50 transition-transform duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-900
          lg:relative lg:z-0 lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-3 dark:border-zinc-800">
          <a
            href="/vaults"
            className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            doc-store
          </a>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Vault switcher */}
        <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
          <VaultSwitcher vaults={vaults} currentVault={currentVault} />
        </div>

        {/* File tree */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!currentVault ? (
            <div className="px-2 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Select a vault to browse files
            </div>
          ) : treeLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : tree ? (
            <FileTree
              tree={tree}
              vaultId={currentVault.id}
              activePath={activePath}
            />
          ) : (
            <div className="px-2 py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
              Could not load file tree
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
