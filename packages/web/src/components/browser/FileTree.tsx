'use client';

import type { TreeNode } from '@doc-store/shared';
import { FileTreeItem } from './FileTreeItem';
import { FileText } from 'lucide-react';

interface FileTreeProps {
  tree: TreeNode[];
  vaultId: string;
  activePath?: string;
}

/**
 * Recursive file tree component for browsing vault documents.
 * Sorts directories first, then files. Each item is collapsible.
 */
export function FileTree({ tree, vaultId, activePath }: FileTreeProps) {
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

  return (
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
    </nav>
  );
}

function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export default FileTree;
