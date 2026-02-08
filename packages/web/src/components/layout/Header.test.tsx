import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockRouter } from '@/__tests__/helpers/next-router';
import { Header } from './Header';
import { useAuthStore } from '@/lib/stores/auth.store';

describe('Header', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: '1',
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'user',
        isActive: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      accessToken: 'token',
      isAuthenticated: true,
    });
  });

  it('renders search button', () => {
    render(
      <Header
        onToggleSidebar={vi.fn()}
        showSidebarToggle={true}
      />
    );

    expect(screen.getByText('Search documents...')).toBeInTheDocument();
  });

  it('calls onOpenSearch when search button clicked', async () => {
    const user = userEvent.setup();
    const onOpenSearch = vi.fn();

    render(
      <Header
        onToggleSidebar={vi.fn()}
        showSidebarToggle={true}
        onOpenSearch={onOpenSearch}
      />
    );

    await user.click(screen.getByText('Search documents...').closest('button')!);

    expect(onOpenSearch).toHaveBeenCalled();
  });

  it('renders hamburger toggle when showSidebarToggle is true', () => {
    render(
      <Header
        onToggleSidebar={vi.fn()}
        showSidebarToggle={true}
      />
    );

    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeInTheDocument();
  });

  it('calls onToggleSidebar when hamburger clicked', async () => {
    const user = userEvent.setup();
    const onToggleSidebar = vi.fn();

    render(
      <Header
        onToggleSidebar={onToggleSidebar}
        showSidebarToggle={true}
      />
    );

    await user.click(screen.getByRole('button', { name: /toggle sidebar/i }));

    expect(onToggleSidebar).toHaveBeenCalled();
  });

  it('renders user menu with display name', () => {
    render(
      <Header
        onToggleSidebar={vi.fn()}
        showSidebarToggle={true}
      />
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('opens user menu dropdown on click', async () => {
    const user = userEvent.setup();

    render(
      <Header
        onToggleSidebar={vi.fn()}
        showSidebarToggle={true}
      />
    );

    await user.click(screen.getAllByText('Test User')[0]);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('API Keys')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('shows admin link when user is admin', async () => {
    const user = userEvent.setup();

    useAuthStore.setState({
      user: {
        id: '1',
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: 'admin',
        isActive: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      accessToken: 'token',
      isAuthenticated: true,
    });

    render(
      <Header
        onToggleSidebar={vi.fn()}
        showSidebarToggle={true}
      />
    );

    await user.click(screen.getAllByText('Admin User')[0]);

    expect(screen.getByText('Invitations')).toBeInTheDocument();
  });

  it('hides admin link when user is not admin', async () => {
    const user = userEvent.setup();

    render(
      <Header
        onToggleSidebar={vi.fn()}
        showSidebarToggle={true}
      />
    );

    await user.click(screen.getAllByText('Test User')[0]);

    expect(screen.queryByText('Invitations')).not.toBeInTheDocument();
  });

  it('logs out and navigates to login on sign out click', async () => {
    const user = userEvent.setup();
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');

    render(
      <Header
        onToggleSidebar={vi.fn()}
        showSidebarToggle={true}
      />
    );

    await user.click(screen.getAllByText('Test User')[0]);
    await user.click(screen.getByText('Sign out'));

    expect(logoutSpy).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });
});
