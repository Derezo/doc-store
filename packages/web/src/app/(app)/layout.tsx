'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, logout, refresh } = useAuthStore();

  useEffect(() => {
    // If we have a persisted user but no access token, try to refresh
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

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-foreground/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <a href="/vaults" className="text-lg font-bold tracking-tight">
              doc-store
            </a>
            <nav className="flex items-center gap-4 text-sm">
              <a
                href="/vaults"
                className="text-foreground/70 transition-colors hover:text-foreground"
              >
                Vaults
              </a>
              <a
                href="/settings/api-keys"
                className="text-foreground/70 transition-colors hover:text-foreground"
              >
                API Keys
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground/60">
              {user?.displayName}
            </span>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="text-sm text-foreground/60 transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
