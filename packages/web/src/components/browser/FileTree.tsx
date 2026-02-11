'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { TreeNode } from '@doc-store/shared';
import { FileTreeItem } from './FileTreeItem';
import { FileText, Folder, Loader2, Trash2 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { FileTreeContext } from './FileTreeContext';
import { useContextMenu } from '@/hooks/useContextMenu';
import { useFileOperations } from '@/hooks/useFileOperations';
import { FileTreeContextMenu } from './FileTreeContextMenu';
import { MoveDialog } from './MoveDialog';
import { CopyDialog } from './CopyDialog';
import { NewFileDialog } from '@/components/editor/NewFileDialog';
import { NewFolderDialog } from './NewFolderDialog';
import { toast } from 'sonner';

interface FileTreeProps {
  tree: TreeNode[];
  vaultId: string;
  activePath?: string;
}

type DialogType = 'move' | 'copy' | 'delete' | 'newFile' | 'newFolder' | null;

/**
 * Recursive file tree component for browsing vault documents.
 * Sorts directories first, then files. Each item is collapsible.
 * Supports drag and drop for moving files and directories.
 * Provides context menu for file operations.
 */
export function FileTree({ tree, vaultId, activePath }: FileTreeProps) {
  const router = useRouter();
  const [activeDragNode, setActiveDragNode] = useState<TreeNode | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    isOpen: isContextMenuOpen,
    position: contextMenuPosition,
    targetNode: contextMenuNode,
    openContextMenu,
    closeContextMenu,
  } = useContextMenu();

  const fileOperations = useFileOperations({
    vaultId,
    onSuccess: () => {
      closeContextMenu();
      setActiveDialog(null);
      setRenamingPath(null);
    },
  });

  // Configure pointer sensor with 8px activation distance to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Vault root drop zone
  const { setNodeRef: rootDropRef, isOver: isRootOver } = useDroppable({
    id: '__vault_root__',
    data: { isRoot: true },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const node = event.active.data.current?.node as TreeNode | undefined;
    if (node) {
      setActiveDragNode(node);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragNode(null);

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const sourceNode = active.data.current?.node as TreeNode | undefined;
      const destData = over.data.current;

      if (!sourceNode) return;

      // Determine destination directory path
      let destinationDir: string;

      if (destData?.isRoot) {
        // Dropped on vault root
        destinationDir = '';
      } else {
        const destNode = destData?.node as TreeNode | undefined;
        if (!destNode) return;

        // Validate: cannot drop onto a file
        if (destNode.type !== 'directory') {
          toast.error('Cannot drop into a file');
          return;
        }

        destinationDir = destNode.path;
      }

      // Get source parent directory
      const sourceParent = sourceNode.path.includes('/')
        ? sourceNode.path.substring(0, sourceNode.path.lastIndexOf('/'))
        : '';

      // Validate: cannot drop into current parent (no-op)
      if (sourceParent === destinationDir) {
        return;
      }

      // Validate: cannot drop directory into itself or its children
      if (sourceNode.type === 'directory') {
        if (sourceNode.path === destinationDir) {
          toast.error('Cannot move a directory into itself');
          return;
        }
        if (destinationDir.startsWith(sourceNode.path + '/')) {
          toast.error('Cannot move a directory into its own subdirectory');
          return;
        }
      }

      // Compute new path
      const newPath = destinationDir ? `${destinationDir}/${sourceNode.name}` : sourceNode.name;

      // Execute move
      const success = await fileOperations.moveItem(sourceNode.path, newPath);

      // If we moved the currently active document, navigate to the new path
      if (success && activePath === sourceNode.path) {
        router.replace(`/vaults/${vaultId}/${newPath}`);
      }
    },
    [fileOperations, activePath, vaultId, router]
  );

  // Calculate children count for delete warnings
  const getChildrenCount = (node: TreeNode): number => {
    if (node.type !== 'directory' || !node.children) return 0;
    let count = node.children.length;
    for (const child of node.children) {
      if (child.type === 'directory') {
        count += getChildrenCount(child);
      }
    }
    return count;
  };

  // Context menu handlers
  const handleRename = useCallback(() => {
    if (!contextMenuNode) return;
    setRenamingPath(contextMenuNode.path);
    closeContextMenu();
  }, [contextMenuNode, closeContextMenu]);

  const handleMove = useCallback(() => {
    setActiveDialog('move');
    closeContextMenu();
  }, [closeContextMenu]);

  const handleCopy = useCallback(() => {
    setActiveDialog('copy');
    closeContextMenu();
  }, [closeContextMenu]);

  const handleDelete = useCallback(() => {
    setActiveDialog('delete');
    closeContextMenu();
  }, [closeContextMenu]);

  const handleNewFile = useCallback(() => {
    setActiveDialog('newFile');
    closeContextMenu();
  }, [closeContextMenu]);

  const handleNewFolder = useCallback(() => {
    setActiveDialog('newFolder');
    closeContextMenu();
  }, [closeContextMenu]);

  // Move dialog handler
  const handleMoveConfirm = useCallback(
    async (destinationDir: string) => {
      if (!contextMenuNode) return;

      const fileName = contextMenuNode.path.split('/').pop() || contextMenuNode.path;
      const destination = destinationDir ? `${destinationDir}/${fileName}` : fileName;

      const success = await fileOperations.moveItem(contextMenuNode.path, destination);

      // If we moved the currently active document, navigate to the new path
      if (success && activePath === contextMenuNode.path) {
        router.replace(`/vaults/${vaultId}/${destination}`);
      }
    },
    [contextMenuNode, fileOperations, activePath, vaultId, router],
  );

  // Copy dialog handler
  const handleCopyConfirm = useCallback(
    async (destinationDir: string) => {
      if (!contextMenuNode) return;

      const fileName = contextMenuNode.path.split('/').pop() || contextMenuNode.path;
      const destination = destinationDir ? `${destinationDir}/${fileName}` : fileName;

      await fileOperations.copyItem(contextMenuNode.path, destination);
    },
    [contextMenuNode, fileOperations],
  );

  // Delete confirmation handler
  const handleDeleteConfirm = useCallback(async () => {
    if (!contextMenuNode) return;

    setIsDeleting(true);
    const success = await fileOperations.deleteItem(contextMenuNode.path);

    if (success) {
      // If we deleted the currently active document or its parent, navigate to vault root
      if (activePath && (activePath === contextMenuNode.path || activePath.startsWith(contextMenuNode.path + '/'))) {
        router.push(`/vaults/${vaultId}`);
      }
      setActiveDialog(null);
    }

    setIsDeleting(false);
  }, [contextMenuNode, fileOperations, activePath, vaultId, router]);

  // New folder handler
  const handleNewFolderConfirm = useCallback(
    async (folderPath: string) => {
      await fileOperations.createDirectory(folderPath);
    },
    [fileOperations],
  );

  // Handle rename operation
  const handleRenameOperation = useCallback(
    async (currentPath: string, newName: string, isFile: boolean) => {
      const renamedPath = await fileOperations.renameItem(currentPath, newName, isFile);

      // If we renamed the currently active document, navigate to the new path
      if (renamedPath && activePath === currentPath) {
        router.replace(`/vaults/${vaultId}/${renamedPath}`);
      }

      setRenamingPath(null);
    },
    [fileOperations, activePath, vaultId, router],
  );

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
        <FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No documents yet
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Create documents via the API or sync from Obsidian
        </p>
      </div>
    );
  }

  const sorted = sortTreeNodes(tree);

  const contextValue = {
    openContextMenu,
    renamingPath,
    setRenamingPath,
    handleRename: handleRenameOperation,
    vaultId,
  };

  return (
    <FileTreeContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <nav className="space-y-0.5 py-1" aria-label="File tree">
          {sorted.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              vaultId={vaultId}
              depth={0}
              activePath={activePath}
              defaultOpen={tree.length <= 10}
            />
          ))}

          {/* Vault root drop zone */}
          <div
            ref={rootDropRef}
            className={`h-8 transition-colors ${
              isRootOver ? 'bg-blue-50 dark:bg-blue-950/30' : ''
            }`}
            aria-label="Drop to move to vault root"
          />
        </nav>

        <DragOverlay>
          {activeDragNode && (
            <div className="flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              {activeDragNode.type === 'directory' ? (
                <Folder className="h-4 w-4 text-zinc-400" />
              ) : (
                <FileText className="h-4 w-4 text-zinc-400" />
              )}
              <span className="text-zinc-700 dark:text-zinc-300">
                {activeDragNode.type === 'file'
                  ? activeDragNode.name.replace(/\.md$/i, '')
                  : activeDragNode.name}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Context menu */}
      {isContextMenuOpen && contextMenuNode && (
        <FileTreeContextMenu
          position={contextMenuPosition}
          node={contextMenuNode}
          onClose={closeContextMenu}
          onRename={handleRename}
          onMove={handleMove}
          onCopy={handleCopy}
          onDelete={handleDelete}
          onNewFile={contextMenuNode.type === 'directory' ? handleNewFile : undefined}
          onNewFolder={contextMenuNode.type === 'directory' ? handleNewFolder : undefined}
        />
      )}

      {/* Move dialog */}
      {activeDialog === 'move' && contextMenuNode && (
        <MoveDialog
          isOpen={true}
          sourcePath={contextMenuNode.path}
          vaultId={vaultId}
          tree={tree}
          onConfirm={handleMoveConfirm}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {/* Copy dialog */}
      {activeDialog === 'copy' && contextMenuNode && (
        <CopyDialog
          isOpen={true}
          sourcePath={contextMenuNode.path}
          vaultId={vaultId}
          tree={tree}
          onConfirm={handleCopyConfirm}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      {activeDialog === 'delete' && contextMenuNode && (
        <DeleteConfirmDialog
          node={contextMenuNode}
          childrenCount={getChildrenCount(contextMenuNode)}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setActiveDialog(null)}
        />
      )}

      {/* New file dialog */}
      {activeDialog === 'newFile' && contextMenuNode && (
        <NewFileDialog
          vaultId={vaultId}
          defaultDir={contextMenuNode.path + '/'}
          isOpen={true}
          onClose={() => setActiveDialog(null)}
        />
      )}

      {/* New folder dialog */}
      {activeDialog === 'newFolder' && contextMenuNode && (
        <NewFolderDialog
          isOpen={true}
          parentPath={contextMenuNode.path}
          onConfirm={handleNewFolderConfirm}
          onClose={() => setActiveDialog(null)}
        />
      )}
    </FileTreeContext.Provider>
  );
}

function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    // Dimmed items go last
    if (a.dimmed !== b.dimmed) {
      return a.dimmed ? 1 : -1;
    }
    // Directories before files
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

// Delete confirmation dialog component
function DeleteConfirmDialog({
  node,
  childrenCount,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  node: TreeNode;
  childrenCount: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const fileName = node.path.split('/').pop() || node.path;
  const isDirectory = node.type === 'directory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Delete {isDirectory ? 'directory' : 'file'}
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
          Are you sure you want to delete{' '}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {fileName}
          </span>
          {isDirectory && childrenCount > 0 && (
            <span> and all {childrenCount} {childrenCount === 1 ? 'item' : 'items'} inside</span>
          )}
          ?
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default FileTree;
