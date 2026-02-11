import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/__tests__/helpers/next-router';
import { FileTreeItem } from './FileTreeItem';
import type { TreeNode } from '@doc-store/shared';
import { DndContext } from '@dnd-kit/core';
import { FileTreeContext, type FileTreeContextValue } from './FileTreeContext';

describe('FileTreeItem - Drag and Drop', () => {
  const mockDirectoryNode: TreeNode = {
    name: 'projects',
    type: 'directory',
    path: 'projects',
    children: [
      {
        name: 'app.md',
        type: 'file',
        path: 'projects/app.md',
      },
    ],
  };

  const mockFileNode: TreeNode = {
    name: 'readme.md',
    type: 'file',
    path: 'readme.md',
  };

  const mockContextValue: FileTreeContextValue = {
    openContextMenu: vi.fn(),
    renamingPath: null,
    setRenamingPath: vi.fn(),
    handleRename: vi.fn(),
    vaultId: 'vault-1',
  };

  const renderWithDnd = (node: TreeNode, activePath?: string) => {
    return render(
      <FileTreeContext.Provider value={mockContextValue}>
        <DndContext>
          <FileTreeItem node={node} vaultId="vault-1" depth={0} activePath={activePath} />
        </DndContext>
      </FileTreeContext.Provider>
    );
  };

  it('renders directory node with drag and drop attributes', () => {
    renderWithDnd(mockDirectoryNode);

    const button = screen.getByRole('button', { name: /projects/ });
    expect(button).toBeInTheDocument();
  });

  it('renders file node with drag attributes', () => {
    renderWithDnd(mockFileNode);

    // Note: @dnd-kit changes the role to "button" when drag attributes are applied
    const link = screen.getByRole('button', { name: /readme/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/vaults/vault-1/readme.md');
  });

  it('directory node shows folder icons', () => {
    const { container } = renderWithDnd(mockDirectoryNode);

    // Should have folder icon
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('file node shows file icon', () => {
    const { container } = renderWithDnd(mockFileNode);

    // Should have file icon
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('applies correct depth padding', () => {
    render(
      <FileTreeContext.Provider value={mockContextValue}>
        <DndContext>
          <FileTreeItem node={mockDirectoryNode} vaultId="vault-1" depth={2} />
        </DndContext>
      </FileTreeContext.Provider>
    );

    const button = screen.getByRole('button', { name: /projects/ });
    expect(button).toHaveStyle({ paddingLeft: '40px' }); // 2 * 16 + 8
  });

  it('renders nested children when expanded by default', () => {
    render(
      <FileTreeContext.Provider value={mockContextValue}>
        <DndContext>
          <FileTreeItem node={mockDirectoryNode} vaultId="vault-1" depth={0} defaultOpen />
        </DndContext>
      </FileTreeContext.Provider>
    );

    expect(screen.getByText('app')).toBeInTheDocument();
  });

  it('shows chevron down when directory is open', () => {
    const { container } = render(
      <FileTreeContext.Provider value={mockContextValue}>
        <DndContext>
          <FileTreeItem node={mockDirectoryNode} vaultId="vault-1" depth={0} defaultOpen />
        </DndContext>
      </FileTreeContext.Provider>
    );

    // ChevronDown should be present when open
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('strips .md extension from file display name', () => {
    renderWithDnd(mockFileNode);

    // Should show "readme" not "readme.md"
    expect(screen.getByText('readme')).toBeInTheDocument();
    expect(screen.queryByText('readme.md')).not.toBeInTheDocument();
  });

  it('applies active styling when path matches', () => {
    renderWithDnd(mockFileNode, 'readme.md');

    // Note: @dnd-kit changes the role to "button" when drag attributes are applied
    const link = screen.getByRole('button', { name: /readme/ });
    expect(link).toHaveClass('bg-blue-50');
  });
});
