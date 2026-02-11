'use client';

import { useState, useEffect } from 'react';
import type { TreeNode } from '@doc-store/shared';
import { X, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';

export interface CopyDialogProps {
  isOpen: boolean;
  sourcePath: string;
  vaultId: string;
  tree: TreeNode[];
  onConfirm: (destinationDir: string) => void;
  onClose: () => void;
}

/**
 * Dialog for copying files/directories.
 * Shows a directory-only tree picker.
 */
export function CopyDialog({
  isOpen,
  sourcePath,
  tree,
  onConfirm,
  onClose,
}: CopyDialogProps) {
  const [selectedDir, setSelectedDir] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSelectedDir('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedDir);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Copy to...
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Select destination directory for <span className="font-medium">{extractName(sourcePath)}</span>
        </p>

        <div className="mt-4 max-h-80 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
          {/* Root option */}
          <button
            onClick={() => setSelectedDir('')}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
              selectedDir === ''
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <Folder className="h-4 w-4 shrink-0" />
            <span>(Root)</span>
          </button>

          {/* Directory tree */}
          {tree.map((node) => (
            <DirectoryTreeItem
              key={node.path}
              node={node}
              selectedDir={selectedDir}
              onSelect={setSelectedDir}
              depth={0}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

interface DirectoryTreeItemProps {
  node: TreeNode;
  selectedDir: string;
  onSelect: (path: string) => void;
  depth: number;
}

function DirectoryTreeItem({
  node,
  selectedDir,
  onSelect,
  depth,
}: DirectoryTreeItemProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Only show directories
  if (node.type !== 'directory') return null;

  const paddingLeft = depth * 16 + 8;
  const isSelected = selectedDir === node.path;

  return (
    <div>
      <button
        onClick={() => {
          onSelect(node.path);
          setIsOpen(!isOpen);
        }}
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm transition-colors ${
          isSelected
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
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
        <span className="shrink-0">
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
          {node.children.map((child) => (
            <DirectoryTreeItem
              key={child.path}
              node={child}
              selectedDir={selectedDir}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function extractName(path: string): string {
  return path.split('/').pop() || path;
}
