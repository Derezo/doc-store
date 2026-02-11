'use client';

import { createContext, useContext } from 'react';
import type { TreeNode } from '@doc-store/shared';

export interface FileTreeContextValue {
  openContextMenu: (event: React.MouseEvent | { clientX: number; clientY: number }, node: TreeNode) => void;
  renamingPath: string | null;
  setRenamingPath: (path: string | null) => void;
  handleRename: (currentPath: string, newName: string, isFile: boolean) => Promise<void>;
  vaultId: string;
}

export const FileTreeContext = createContext<FileTreeContextValue | null>(null);

export function useFileTreeContext() {
  const context = useContext(FileTreeContext);
  if (!context) {
    throw new Error('useFileTreeContext must be used within FileTreeContext.Provider');
  }
  return context;
}
