'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import {
  Menu,
  Search,
  User,
  Settings,
  Key,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  showSidebarToggle: boolean;
  breadcrumbs?: React.ReactNode;
  onOpenSearch?: () => void;
}

/**
 * Application header with hamburger menu, breadcrumbs, search placeholder, and user menu.
 */
export function Header({
  onToggleSidebar,
  showSidebarToggle,
  breadcrumbs,
  onOpenSearch,
}: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Left: Hamburger + Breadcrumbs */}
      <div className="flex items-center gap-3">
        {showSidebarToggle && (
          <button
            onClick={onToggleSidebar}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {breadcrumbs && <div className="hidden sm:block">{breadcrumbs}</div>}
      </div>

      {/* Center: Search placeholder */}
      <div className="flex flex-1 justify-center">
        <button
          className="flex w-full max-w-md items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-500 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          onClick={() => onOpenSearch?.()}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search documents...</span>
          <kbd className="hidden rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs font-medium text-zinc-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-500 sm:inline">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: User menu */}
      <div className="relative" ref={userMenuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
            <User className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
          </div>
          <span className="hidden text-zinc-700 dark:text-zinc-300 sm:block">
            {user?.displayName}
          </span>
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {user?.displayName}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {user?.email}
              </p>
            </div>

            <Link
              href="/settings/api-keys"
              onClick={() => setUserMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <Key className="h-4 w-4" />
              <span>API Keys</span>
            </Link>

            <button
              onClick={() => {
                setUserMenuOpen(false);
                handleSignOut();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
