'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { TreeNode } from '@doc-store/shared';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useFileTreeContext } from './FileTreeContext';
import { RenameInput } from './RenameInput';

interface FileTreeItemProps {
  node: TreeNode;
  vaultId: string;
  depth: number;
  activePath?: string;
  defaultOpen?: boolean;
}

export function FileTreeItem({
  node,
  vaultId,
  depth,
  activePath,
  defaultOpen = false,
}: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen || isAncestorOfActive(node, activePath));
  const isActive = activePath === node.path;
  const isDirectory = node.type === 'directory';
  const paddingLeft = depth * 16 + 8;

  // Context menu and rename from FileTreeContext
  const { openContextMenu, renamingPath, setRenamingPath, handleRename } = useFileTreeContext();
  const isRenaming = renamingPath === node.path;

  // Long-press detection for mobile
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      openContextMenu({ clientX: touch.clientX, clientY: touch.clientY }, node);
    }, 500);
  }, [openContextMenu, node]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu(e, node);
  }, [openContextMenu, node]);

  // Draggable setup (all items can be dragged)
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: node.path,
    data: { node },
  });

  // Droppable setup (only directories can be drop targets)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.path,
    data: { node },
    disabled: !isDirectory,
  });

  // Auto-expand collapsed directories on hover
  const expandTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isDirectory && isOver && !isOpen) {
      // Start timer to auto-expand after 500ms
      expandTimerRef.current = setTimeout(() => {
        setIsOpen(true);
      }, 500);
    } else {
      // Clear timer when no longer hovering or already open
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
        expandTimerRef.current = null;
      }
    }

    return () => {
      if (expandTimerRef.current) {
        clearTimeout(expandTimerRef.current);
      }
    };
  }, [isDirectory, isOver, isOpen]);

  // Combine refs for directories (draggable + droppable)
  const combinedRef = useCallback(
    (el: HTMLElement | null) => {
      setDragRef(el);
      if (isDirectory) {
        setDropRef(el);
      }
    },
    [setDragRef, setDropRef, isDirectory]
  );

  if (isDirectory) {
    return (
      <div className={node.dimmed ? 'opacity-40' : ''}>
        <button
          ref={combinedRef}
          onClick={() => setIsOpen(!isOpen)}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
            isActive
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-zinc-700 dark:text-zinc-300'
          } ${isDragging ? 'opacity-30' : ''} ${
            isOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30' : ''
          }`}
          style={{ paddingLeft }}
          {...dragAttributes}
          {...dragListeners}
        >
          <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
          <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
            {isOpen ? (
              <FolderOpen className="h-4 w-4" />
            ) : (
              <Folder className="h-4 w-4" />
            )}
          </span>
          {isRenaming ? (
            <RenameInput
              currentName={node.name}
              isFile={false}
              onSubmit={(newName) => handleRename(node.path, newName, false)}
              onCancel={() => setRenamingPath(null)}
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </button>

        {isOpen && node.children && (
          <div>
            {sortTreeNodes(node.children).map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                vaultId={vaultId}
                depth={depth + 1}
                activePath={activePath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node (only draggable, not droppable)
  return (
    <Link
      ref={setDragRef}
      href={`/vaults/${vaultId}/${node.path}`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
        isActive
          ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
          : 'text-zinc-600 dark:text-zinc-400'
      } ${isDragging ? 'opacity-30' : ''} ${node.dimmed ? 'opacity-40' : ''}`}
      style={{ paddingLeft: paddingLeft + 18 }}
      {...dragAttributes}
      {...dragListeners}
    >
      <span className="shrink-0">
        <FileText className="h-4 w-4" />
      </span>
      {isRenaming ? (
        <RenameInput
          currentName={node.name}
          isFile={true}
          onSubmit={(newName) => handleRename(node.path, newName, true)}
          onCancel={() => setRenamingPath(null)}
        />
      ) : (
        <span className="truncate">{stripExtension(node.name)}</span>
      )}
    </Link>
  );
}

/**
 * Sort tree nodes: dimmed items last, then directories first (alphabetical), then files (alphabetical).
 */
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

/**
 * Check if a node is an ancestor of the active path.
 */
function isAncestorOfActive(node: TreeNode, activePath?: string): boolean {
  if (!activePath || node.type !== 'directory') return false;
  return activePath.startsWith(node.path + '/');
}

/**
 * Remove .md extension from display name.
 */
function stripExtension(name: string): string {
  return name.replace(/\.md$/i, '');
}

export default FileTreeItem;
