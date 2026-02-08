import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/__tests__/helpers/next-router';
import { Breadcrumbs } from './Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders vault name as root segment', () => {
    render(<Breadcrumbs vaultId="vault-1" vaultName="My Vault" />);

    expect(screen.getByText('My Vault')).toBeInTheDocument();
  });

  it('renders path segments as links', () => {
    render(
      <Breadcrumbs
        vaultId="vault-1"
        vaultName="My Vault"
        path="folder/subfolder/file.md"
      />
    );

    expect(screen.getByText('My Vault')).toBeInTheDocument();
    expect(screen.getByText('folder')).toBeInTheDocument();
    expect(screen.getByText('subfolder')).toBeInTheDocument();
    expect(screen.getByText('file')).toBeInTheDocument();
  });

  it('strips .md extension from final segment', () => {
    render(
      <Breadcrumbs
        vaultId="vault-1"
        vaultName="My Vault"
        path="notes/hello.md"
      />
    );

    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.queryByText('hello.md')).not.toBeInTheDocument();
  });

  it('handles root path without documents', () => {
    render(<Breadcrumbs vaultId="vault-1" vaultName="My Vault" />);

    expect(screen.getByText('My Vault')).toBeInTheDocument();
    // Should only have Home link (vault name is not a link when it's the last segment)
    const homeLink = screen.getByRole('link');
    expect(homeLink).toBeInTheDocument();
  });

  it('generates correct href for each segment', () => {
    render(
      <Breadcrumbs
        vaultId="vault-1"
        vaultName="My Vault"
        path="folder/file.md"
      />
    );

    const folderLink = screen.getByText('folder').closest('a');
    expect(folderLink).toHaveAttribute('href', '/vaults/vault-1/folder');

    const fileSegment = screen.getByText('file');
    expect(fileSegment.tagName).toBe('SPAN'); // Last segment is not a link
  });
});
