import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/__tests__/mocks/server';
import { mockRouter } from '@/__tests__/helpers/next-router';
import { NewFileDialog } from './NewFileDialog';

// Mock the vault store
const mockFetchTree = vi.fn();
vi.mock('@/lib/stores/vault.store', () => ({
  useVaultStore: () => ({
    fetchTree: mockFetchTree,
  }),
}));

describe('NewFileDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <NewFileDialog vaultId="vault-1" isOpen={false} onClose={vi.fn()} />
    );

    expect(screen.queryByText('New file')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true', () => {
    render(
      <NewFileDialog vaultId="vault-1" isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByText('New file')).toBeInTheDocument();
    expect(screen.getByLabelText('File name')).toBeInTheDocument();
  });

  it('auto-appends .md extension to filename', async () => {
    const user = userEvent.setup();

    server.use(
      http.put('http://localhost:4000/api/v1/vaults/vault-1/documents/test', () => {
        return HttpResponse.json({ document: {} });
      })
    );

    render(
      <NewFileDialog vaultId="vault-1" isOpen={true} onClose={vi.fn()} />
    );

    await user.type(screen.getByLabelText('File name'), 'test');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockFetchTree).toHaveBeenCalledWith('vault-1');
    });
  });

  it('rejects invalid paths with double dots', async () => {
    const user = userEvent.setup();

    render(
      <NewFileDialog vaultId="vault-1" isOpen={true} onClose={vi.fn()} />
    );

    await user.type(screen.getByLabelText('File name'), '../evil.md');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText('Invalid file path')).toBeInTheDocument();
    expect(mockFetchTree).not.toHaveBeenCalled();
  });

  it('rejects paths with leading slash', async () => {
    const user = userEvent.setup();

    render(
      <NewFileDialog vaultId="vault-1" isOpen={true} onClose={vi.fn()} />
    );

    await user.type(screen.getByLabelText('File name'), '/root.md');
    await user.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText('Invalid file path')).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <NewFileDialog vaultId="vault-1" isOpen={true} onClose={onClose} />
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('navigates to new document after successful creation', async () => {
    const user = userEvent.setup();

    server.use(
      http.put('http://localhost:4000/api/v1/vaults/vault-1/documents/notes/test.md', () => {
        return HttpResponse.json({ document: {} });
      })
    );

    render(
      <NewFileDialog vaultId="vault-1" defaultDir="notes/" isOpen={true} onClose={vi.fn()} />
    );

    await user.type(screen.getByLabelText('File name'), 'test.md');
    await user.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/vaults/vault-1/notes/test.md');
    });
  });
});
