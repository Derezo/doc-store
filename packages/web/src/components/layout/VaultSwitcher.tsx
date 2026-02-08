'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { Vault } from '@doc-store/shared';
import { ChevronsUpDown, Check, Plus, BookOpen } from 'lucide-react';

interface VaultSwitcherProps {
  vaults: Vault[];
  currentVault: Vault | null;
}

/**
 * Dropdown in the sidebar header for switching between vaults.
 */
export function VaultSwitcher({ vaults, currentVault }: VaultSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750"
      >
        <BookOpen className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <span className="flex-1 truncate font-medium">
          {currentVault?.name ?? 'Select a vault'}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {vaults.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              No vaults yet
            </p>
          ) : (
            vaults.map((vault) => (
              <Link
                key={vault.id}
                href={`/vaults/${vault.id}`}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                  vault.id === currentVault?.id
                    ? 'bg-zinc-50 dark:bg-zinc-750'
                    : ''
                }`}
              >
                <span className="flex-1 truncate">{vault.name}</span>
                {vault.id === currentVault?.id && (
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                )}
              </Link>
            ))
          )}

          <div className="border-t border-zinc-100 dark:border-zinc-700">
            <Link
              href="/vaults"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" />
              <span>All Vaults</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default VaultSwitcher;
