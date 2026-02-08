import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/__tests__/mocks/server';
import { mockRouter } from '@/__tests__/helpers/next-router';
import { useAuthStore } from '@/lib/stores/auth.store';
import LoginPage from './page';

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    });
    vi.clearAllMocks();
  });

  it('renders form with email and password fields', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('displays validation errors for empty fields', async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid credentials and navigates to /vaults', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:4000/api/v1/auth/login', () => {
        return HttpResponse.json({
          user: {
            id: '1',
            email: 'test@example.com',
            displayName: 'Test User',
            role: 'user',
            isActive: true,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          accessToken: 'test-token',
        });
      })
    );

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/vaults');
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:4000/api/v1/auth/login', () => {
        return HttpResponse.json(
          { message: 'Invalid credentials' },
          { status: 401 }
        );
      })
    );

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('displays network error on request failure', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:4000/api/v1/auth/login', () => {
        return HttpResponse.error();
      })
    );

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const user = userEvent.setup();

    server.use(
      http.post('http://localhost:4000/api/v1/auth/login', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ user: {}, accessToken: 'token' });
      })
    );

    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
  });
});
