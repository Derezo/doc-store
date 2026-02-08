import ky, { type KyInstance, type BeforeRequestHook, type BeforeRetryHook } from 'ky';
import { useAuthStore } from './stores/auth.store.js';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const beforeRequest: BeforeRequestHook = (request) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
};

const beforeRetry: BeforeRetryHook = async ({ request, error, retryCount }) => {
  // Only attempt refresh on first retry of a 401
  if (retryCount > 0) return ky.stop;

  // Don't retry auth endpoints to avoid loops
  if (request.url.includes('/auth/refresh') || request.url.includes('/auth/login')) {
    return ky.stop;
  }

  // Check if it was a 401
  const response = (error as any).response as Response | undefined;
  if (!response || response.status !== 401) return ky.stop;

  // Try refreshing the token
  const refreshed = await useAuthStore.getState().refresh();
  if (!refreshed) {
    useAuthStore.getState().logout();
    return ky.stop;
  }

  // Update the request with the new token
  const newToken = useAuthStore.getState().accessToken;
  if (newToken) {
    request.headers.set('Authorization', `Bearer ${newToken}`);
  }
};

export const api: KyInstance = ky.create({
  prefixUrl: API_BASE,
  credentials: 'include',
  retry: {
    limit: 1,
    statusCodes: [401],
    methods: ['get', 'post', 'put', 'patch', 'delete'],
  },
  hooks: {
    beforeRequest: [beforeRequest],
    beforeRetry: [beforeRetry],
  },
});
