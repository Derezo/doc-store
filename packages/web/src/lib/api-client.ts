import ky, { type KyInstance, type BeforeRequestHook, type AfterResponseHook } from 'ky';
import { useAuthStore } from './stores/auth.store.js';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const beforeRequest: BeforeRequestHook = (request) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
};

const afterResponse: AfterResponseHook = async (request, _options, response) => {
  if (response.status !== 401) return;

  // Avoid infinite loop - don't retry the refresh endpoint itself
  if (request.url.includes('/auth/refresh')) return;

  // Try refreshing the token
  const refreshed = await useAuthStore.getState().refresh();
  if (!refreshed) {
    useAuthStore.getState().logout();
    return;
  }

  // Retry the original request is not directly supported by afterResponse,
  // so we'll handle 401s at the component level via the store.
};

export const api: KyInstance = ky.create({
  prefixUrl: API_BASE,
  credentials: 'include', // Send cookies (refresh token)
  hooks: {
    beforeRequest: [beforeRequest],
    afterResponse: [afterResponse],
  },
});
