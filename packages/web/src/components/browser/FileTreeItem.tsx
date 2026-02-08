'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TreeNode } from '@doc-store/shared';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
} from 'lucide-react';

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

  if (isDirectory) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
            isActive
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-zinc-700 dark:text-zinc-300'
          }`}
          style={{ paddingLeft }}
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
          <span className="truncate">{node.name}</span>
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

  // File node
  return (
    <Link
      href={`/vaults/${vaultId}/${node.path}`}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
        isActive
          ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
          : 'text-zinc-600 dark:text-zinc-400'
      }`}
      style={{ paddingLeft: paddingLeft + 18 }}
    >
      <span className="shrink-0">
        <FileText className="h-4 w-4" />
      </span>
      <span className="truncate">{stripExtension(node.name)}</span>
    </Link>
  );
}

/**
 * Sort tree nodes: directories first (alphabetical), then files (alphabetical).
 */
function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
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
