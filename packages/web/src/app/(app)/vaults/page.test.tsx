import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/__tests__/mocks/server';
import { mockRouter } from '@/__tests__/helpers/next-router';
import { mockVault } from '@/__tests__/mocks/data';
import VaultsPage from './page';

describe('VaultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders vault grid with vaults', async () => {
    const vault1 = mockVault({ id: 'v1', name: 'Vault 1' });
    const vault2 = mockVault({ id: 'v2', name: 'Vault 2' });

    server.use(
      http.get('http://localhost:4000/api/v1/vaults', () => {
        return HttpResponse.json({ vaults: [vault1, vault2] });
      })
    );

    render(<VaultsPage />);

    await waitFor(() => {
      expect(screen.getByText('Vault 1')).toBeInTheDocument();
      expect(screen.getByText('Vault 2')).toBeInTheDocument();
    });
  });

  it('opens create vault modal on button click', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('http://localhost:4000/api/v1/vaults', () => {
        return HttpResponse.json({ vaults: [] });
      })
    );

    render(<VaultsPage />);

    await waitFor(() => {
      expect(screen.getByText('Vaults')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /new vault/i }));

    expect(screen.getByText('Create New Vault')).toBeInTheDocument();
  });

  it('creates new vault and navigates to it', async () => {
    const user = userEvent.setup();
    const newVault = mockVault({ id: 'new-vault', name: 'My New Vault' });

    server.use(
      http.get('http://localhost:4000/api/v1/vaults', () => {
        return HttpResponse.json({ vaults: [] });
      }),
      http.post('http://localhost:4000/api/v1/vaults', () => {
        return HttpResponse.json({ vault: newVault }, { status: 201 });
      })
    );

    render(<VaultsPage />);

    await waitFor(() => {
      expect(screen.getByText('Vaults')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /new vault/i }));

    await user.type(screen.getByLabelText(/name/i), 'My New Vault');

    // Use getAllByRole and find the submit button in the form (not the empty state button)
    const createButtons = screen.getAllByRole('button', { name: /create vault/i });
    await user.click(createButtons[0]); // First one is in the modal form

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/vaults/new-vault');
    });
  });

  it('shows empty state when no vaults exist', async () => {
    server.use(
      http.get('http://localhost:4000/api/v1/vaults', () => {
        return HttpResponse.json({ vaults: [] });
      })
    );

    render(<VaultsPage />);

    await waitFor(() => {
      expect(screen.getByText('No vaults yet')).toBeInTheDocument();
      expect(screen.getByText(/Create your first vault/)).toBeInTheDocument();
    });
  });

  it('clicking vault card navigates to vault page', async () => {
    const user = userEvent.setup();
    const vault = mockVault({ id: 'vault-123', name: 'Test Vault' });

    server.use(
      http.get('http://localhost:4000/api/v1/vaults', () => {
        return HttpResponse.json({ vaults: [vault] });
      })
    );

    render(<VaultsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Vault')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Test Vault').closest('button')!);

    expect(mockRouter.push).toHaveBeenCalledWith('/vaults/vault-123');
  });

  it('displays vault description when available', async () => {
    const vault = mockVault({
      name: 'My Vault',
      description: 'This is a test vault description',
    });

    server.use(
      http.get('http://localhost:4000/api/v1/vaults', () => {
        return HttpResponse.json({ vaults: [vault] });
      })
    );

    render(<VaultsPage />);

    await waitFor(() => {
      expect(screen.getByText('This is a test vault description')).toBeInTheDocument();
    });
  });
});
