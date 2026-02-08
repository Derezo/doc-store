import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/__tests__/mocks/server';
import { mockRouter, mockSearchParams } from '@/__tests__/helpers/next-router';
import { useAuthStore } from '@/lib/stores/auth.store';
import RegisterPage from './page';

describe('RegisterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
    vi.clearAllMocks();
  });

  it('shows error without invite token in URL', () => {
    // Mock empty search params
    (mockSearchParams as any).get = vi.fn(() => null);

    render(<RegisterPage />);

    expect(screen.getByText(/invitation token is required/i)).toBeInTheDocument();
  });

  it('renders form when invite token is present', () => {
    (mockSearchParams as any).get = vi.fn((key: string) => {
      if (key === 'token') return 'valid-invite-token';
      return null;
    });

    render(<RegisterPage />);

    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();

    (mockSearchParams as any).get = vi.fn((key: string) => {
      if (key === 'token') return 'valid-invite-token';
      return null;
    });

    server.use(
      http.post('http://localhost:4000/api/v1/auth/register', () => {
        return HttpResponse.json({
          user: {
            id: '1',
            email: 'newuser@example.com',
            displayName: 'New User',
            role: 'user',
            isActive: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          accessToken: 'new-token',
        });
      })
    );

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/display name/i), 'New User');
    await user.type(screen.getByLabelText(/password/i), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/vaults');
    });
  });

  it('navigates to /vaults on successful registration', async () => {
    const user = userEvent.setup();

    (mockSearchParams as any).get = vi.fn((key: string) => {
      if (key === 'token') return 'valid-invite-token';
      return null;
    });

    server.use(
      http.post('http://localhost:4000/api/v1/auth/register', () => {
        return HttpResponse.json({
          user: {
            id: '1',
            email: 'test@example.com',
            displayName: 'Test',
            role: 'user',
            isActive: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          accessToken: 'token',
        });
      })
    );

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/display name/i), 'Test');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/vaults');
    });
  });

  it('displays error message on registration failure', async () => {
    const user = userEvent.setup();

    (mockSearchParams as any).get = vi.fn((key: string) => {
      if (key === 'token') return 'invalid-token';
      return null;
    });

    server.use(
      http.post('http://localhost:4000/api/v1/auth/register', () => {
        return HttpResponse.json(
          { message: 'Invalid invitation token' },
          { status: 400 }
        );
      })
    );

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/display name/i), 'Test');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid invitation token')).toBeInTheDocument();
    });
  });

  it('shows link to login page', () => {
    (mockSearchParams as any).get = vi.fn((key: string) => {
      if (key === 'token') return 'valid-token';
      return null;
    });

    render(<RegisterPage />);

    const loginLink = screen.getByRole('link', { name: /sign in/i });
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('disables submit button while loading', async () => {
    const user = userEvent.setup();

    (mockSearchParams as any).get = vi.fn((key: string) => {
      if (key === 'token') return 'valid-token';
      return null;
    });

    server.use(
      http.post('http://localhost:4000/api/v1/auth/register', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ user: {}, accessToken: 'token' });
      })
    );

    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/display name/i), 'Test');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
  });
});
