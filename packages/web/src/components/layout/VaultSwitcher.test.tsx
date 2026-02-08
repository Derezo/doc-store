import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/__tests__/helpers/next-router';
import { VaultSwitcher } from './VaultSwitcher';
import { mockVault } from '@/__tests__/mocks/data';

describe('VaultSwitcher', () => {
  it('shows current vault name', () => {
    const vault = mockVault({ name: 'My Notes' });

    render(<VaultSwitcher vaults={[vault]} currentVault={vault} />);

    expect(screen.getByText('My Notes')).toBeInTheDocument();
  });

  it('shows "Select a vault" when no current vault', () => {
    render(<VaultSwitcher vaults={[]} currentVault={null} />);

    expect(screen.getByText('Select a vault')).toBeInTheDocument();
  });

  it('opens dropdown with vault list on click', async () => {
    const user = userEvent.setup();
    const vault1 = mockVault({ id: 'v1', name: 'Vault 1' });
    const vault2 = mockVault({ id: 'v2', name: 'Vault 2' });

    render(<VaultSwitcher vaults={[vault1, vault2]} currentVault={vault1} />);

    await user.click(screen.getAllByText('Vault 1')[0]);

    expect(screen.getByText('Vault 2')).toBeInTheDocument();
    expect(screen.getByText('All Vaults')).toBeInTheDocument();
  });

  it('shows check mark next to current vault', async () => {
    const user = userEvent.setup();
    const vault1 = mockVault({ id: 'v1', name: 'Vault 1' });
    const vault2 = mockVault({ id: 'v2', name: 'Vault 2' });

    render(<VaultSwitcher vaults={[vault1, vault2]} currentVault={vault1} />);

    await user.click(screen.getAllByText('Vault 1')[0]);

    const vault1Link = screen.getAllByText('Vault 1')[1].closest('a');
    expect(vault1Link?.querySelector('svg')).toBeInTheDocument(); // Check icon
  });

  it('clicking vault navigates to vault page', async () => {
    const user = userEvent.setup();
    const vault1 = mockVault({ id: 'vault-123', name: 'Vault 1' });

    render(<VaultSwitcher vaults={[vault1]} currentVault={null} />);

    await user.click(screen.getByText('Select a vault'));

    const vaultLink = screen.getByText('Vault 1').closest('a');
    expect(vaultLink).toHaveAttribute('href', '/vaults/vault-123');
  });

  it('shows "All Vaults" link at bottom of dropdown', async () => {
    const user = userEvent.setup();
    const vault = mockVault({ name: 'Test Vault' });

    render(<VaultSwitcher vaults={[vault]} currentVault={vault} />);

    await user.click(screen.getAllByText('Test Vault')[0]);

    const allVaultsLink = screen.getByText('All Vaults').closest('a');
    expect(allVaultsLink).toHaveAttribute('href', '/vaults');
  });
});
