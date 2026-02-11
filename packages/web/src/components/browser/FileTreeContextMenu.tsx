'use client';

import type { TreeNode } from '@doc-store/shared';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import {
  Pencil,
  ArrowRight,
  Copy,
  Trash2,
  FilePlus,
  FolderPlus,
} from 'lucide-react';

export interface FileTreeContextMenuProps {
  position: { x: number; y: number };
  node: TreeNode;
  onClose: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
}

/**
 * Context menu for file tree items.
 * Different items for files vs directories.
 */
export function FileTreeContextMenu({
  position,
  node,
  onClose,
  onRename,
  onMove,
  onCopy,
  onDelete,
  onNewFile,
  onNewFolder,
}: FileTreeContextMenuProps) {
  const isDirectory = node.type === 'directory';

  const items: (ContextMenuItem | 'separator')[] = isDirectory
    ? [
        {
          label: 'New File',
          icon: <FilePlus className="h-4 w-4" />,
          onClick: onNewFile!,
          disabled: !onNewFile,
        },
        {
          label: 'New Folder',
          icon: <FolderPlus className="h-4 w-4" />,
          onClick: onNewFolder!,
          disabled: !onNewFolder,
        },
        'separator',
        {
          label: 'Rename',
          icon: <Pencil className="h-4 w-4" />,
          onClick: onRename,
        },
        {
          label: 'Move to...',
          icon: <ArrowRight className="h-4 w-4" />,
          onClick: onMove,
        },
        {
          label: 'Copy to...',
          icon: <Copy className="h-4 w-4" />,
          onClick: onCopy,
        },
        'separator',
        {
          label: 'Delete',
          icon: <Trash2 className="h-4 w-4" />,
          onClick: onDelete,
          variant: 'danger' as const,
        },
      ]
    : [
        {
          label: 'Rename',
          icon: <Pencil className="h-4 w-4" />,
          onClick: onRename,
        },
        {
          label: 'Move to...',
          icon: <ArrowRight className="h-4 w-4" />,
          onClick: onMove,
        },
        {
          label: 'Copy to...',
          icon: <Copy className="h-4 w-4" />,
          onClick: onCopy,
        },
        'separator',
        {
          label: 'Delete',
          icon: <Trash2 className="h-4 w-4" />,
          onClick: onDelete,
          variant: 'danger' as const,
        },
      ];

  return <ContextMenu position={position} items={items} onClose={onClose} />;
}
