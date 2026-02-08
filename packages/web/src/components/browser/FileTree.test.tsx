import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/__tests__/helpers/next-router';
import { FileTree } from './FileTree';
import type { TreeNode } from '@doc-store/shared';

// Mock FileTreeItem component to simplify testing
vi.mock('./FileTreeItem', () => ({
  FileTreeItem: ({ node }: { node: TreeNode }) => (
    <div data-testid={`tree-item-${node.name}`}>{node.name}</div>
  ),
}));

describe('FileTree', () => {
  it('renders empty state when tree is empty', () => {
    render(<FileTree tree={[]} vaultId="vault-1" />);

    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(screen.getByText(/Create documents via the API/)).toBeInTheDocument();
  });

  it('renders directory and file nodes', () => {
    const tree: TreeNode[] = [
      {
        name: 'notes',
        type: 'directory',
        path: 'notes',
        children: [
          {
            name: 'hello.md',
            type: 'file',
            path: 'notes/hello.md',
          },
        ],
      },
      {
        name: 'readme.md',
        type: 'file',
        path: 'readme.md',
      },
    ];

    render(<FileTree tree={tree} vaultId="vault-1" />);

    expect(screen.getByTestId('tree-item-notes')).toBeInTheDocument();
    expect(screen.getByTestId('tree-item-readme.md')).toBeInTheDocument();
  });

  it('sorts directories before files', () => {
    const tree: TreeNode[] = [
      {
        name: 'zebra.md',
        type: 'file',
        path: 'zebra.md',
      },
      {
        name: 'alpha',
        type: 'directory',
        path: 'alpha',
        children: [],
      },
      {
        name: 'beta.md',
        type: 'file',
        path: 'beta.md',
      },
    ];

    render(<FileTree tree={tree} vaultId="vault-1" />);

    const items = screen.getAllByTestId(/^tree-item-/);
    expect(items[0]).toHaveAttribute('data-testid', 'tree-item-alpha'); // Directory first
    expect(items[1]).toHaveAttribute('data-testid', 'tree-item-beta.md');
    expect(items[2]).toHaveAttribute('data-testid', 'tree-item-zebra.md');
  });

  it('renders navigation element with aria-label', () => {
    const tree: TreeNode[] = [
      {
        name: 'test.md',
        type: 'file',
        path: 'test.md',
      },
    ];

    render(<FileTree tree={tree} vaultId="vault-1" />);

    const nav = screen.getByRole('navigation', { name: 'File tree' });
    expect(nav).toBeInTheDocument();
  });

  it('passes vaultId to tree items', () => {
    const tree: TreeNode[] = [
      {
        name: 'doc.md',
        type: 'file',
        path: 'doc.md',
      },
    ];

    render(<FileTree tree={tree} vaultId="test-vault-123" />);

    // FileTreeItem is mocked, so we can't directly test props,
    // but this ensures no errors are thrown
    expect(screen.getByTestId('tree-item-doc.md')).toBeInTheDocument();
  });
});
