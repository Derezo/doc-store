'use client';

import { create } from 'zustand';
import type { User, AuthResponse } from '@doc-store/shared';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  setAuth: (_data: AuthResponse) => void;
  logout: () => void;
  refresh: () => Promise<boolean>;
}

// Restore user from localStorage (but NOT the token - that stays in memory)
function getPersistedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('doc_store_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem('doc_store_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('doc_store_user');
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getPersistedUser(),
  accessToken: null,
  isAuthenticated: false,

  setAuth: (data: AuthResponse) => {
    persistUser(data.user);
    set({
      user: data.user,
      accessToken: data.accessToken,
      isAuthenticated: true,
    });
  },

  logout: () => {
    const token = get().accessToken;
    // Fire-and-forget logout call
    if (token) {
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/logout`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        },
      ).catch(() => {});
    }
    persistUser(null);
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
  },

  refresh: async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1/auth/refresh`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Requested-With': 'doc-store' },
        },
      );

      if (!res.ok) return false;

      const data: AuthResponse = await res.json();
      get().setAuth(data);
      return true;
    } catch {
      return false;
    }
  },
}));
