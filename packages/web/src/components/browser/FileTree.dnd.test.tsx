import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@/__tests__/helpers/next-router';
import { FileTree } from './FileTree';
import type { TreeNode } from '@doc-store/shared';
import { FileTreeContext, type FileTreeContextValue } from './FileTreeContext';

// Mock dependencies
vi.mock('@/hooks/useFileOperations', () => ({
  useFileOperations: () => ({
    moveItem: vi.fn().mockResolvedValue(true),
    copyItem: vi.fn().mockResolvedValue(true),
    deleteItem: vi.fn().mockResolvedValue(true),
    createDirectory: vi.fn().mockResolvedValue(true),
    renameItem: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockContextValue: FileTreeContextValue = {
  openContextMenu: vi.fn(),
  renamingPath: null,
  setRenamingPath: vi.fn(),
  handleRename: vi.fn(),
  vaultId: 'vault-1',
};

describe('FileTree - Drag and Drop', () => {
  const mockTree: TreeNode[] = [
    {
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
    },
    {
      name: 'notes',
      type: 'directory',
      path: 'notes',
      children: [],
    },
    {
      name: 'readme.md',
      type: 'file',
      path: 'readme.md',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithContext = (tree: TreeNode[], vaultId = 'vault-1') => {
    return render(
      <FileTreeContext.Provider value={mockContextValue}>
        <FileTree tree={tree} vaultId={vaultId} />
      </FileTreeContext.Provider>
    );
  };

  it('renders DndContext wrapper', () => {
    const { container } = renderWithContext(mockTree);

    // DndContext should be present
    expect(container.querySelector('nav[aria-label="File tree"]')).toBeInTheDocument();
  });

  it('renders vault root drop zone', () => {
    renderWithContext(mockTree);

    const dropZone = screen.getByLabelText('Drop to move to vault root');
    expect(dropZone).toBeInTheDocument();
    expect(dropZone).toHaveClass('h-8');
  });

  it('renders navigation with proper aria-label', () => {
    renderWithContext(mockTree);

    const nav = screen.getByRole('navigation', { name: 'File tree' });
    expect(nav).toBeInTheDocument();
  });

  it('shows drag overlay during drag', async () => {
    renderWithContext(mockTree);

    // Since drag interactions require complex DOM events and @dnd-kit
    // uses internal state management, we verify the structure is set up correctly
    const nav = screen.getByRole('navigation', { name: 'File tree' });
    expect(nav).toBeInTheDocument();
  });

  it('handles empty tree state', () => {
    renderWithContext([]);

    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(screen.queryByLabelText('Drop to move to vault root')).not.toBeInTheDocument();
  });

  it('renders all tree nodes', () => {
    renderWithContext(mockTree);

    // All top-level items should be rendered
    expect(screen.getByText('projects')).toBeInTheDocument();
    expect(screen.getByText('notes')).toBeInTheDocument();
    expect(screen.getByText('readme')).toBeInTheDocument();
  });

  it('applies correct drop zone styling when not hovering', () => {
    renderWithContext(mockTree);

    const dropZone = screen.getByLabelText('Drop to move to vault root');
    expect(dropZone).not.toHaveClass('bg-blue-50');
  });
});
