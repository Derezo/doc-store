import { vi } from 'vitest';

export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn().mockResolvedValue(undefined),
};

export const mockPathname = '/';
export const mockParams = {};
export const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useParams: () => mockParams,
  useSearchParams: () => mockSearchParams,
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
