'use client';

import { useState, useCallback, useEffect } from 'react';
import type { TreeNode } from '@doc-store/shared';

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number; y: number };
  targetNode: TreeNode | null;
}

/**
 * Hook for managing context menu state and position.
 * Handles viewport edge clamping to ensure menu stays visible.
 */
export function useContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    targetNode: null,
  });

  const openContextMenu = useCallback(
    (event: React.MouseEvent | { clientX: number; clientY: number }, node: TreeNode) => {
      if ('preventDefault' in event) {
        event.preventDefault();
      }

      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Estimated menu dimensions (will be clamped in ContextMenu component as well)
      const menuWidth = 220;
      const menuHeight = 300;

      // Clamp position to keep menu within viewport
      let x = event.clientX;
      let y = event.clientY;

      if (x + menuWidth > viewportWidth) {
        x = viewportWidth - menuWidth - 10;
      }

      if (y + menuHeight > viewportHeight) {
        y = viewportHeight - menuHeight - 10;
      }

      setState({
        isOpen: true,
        position: { x, y },
        targetNode: node,
      });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!state.isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [state.isOpen, closeContextMenu]);

  return {
    isOpen: state.isOpen,
    position: state.position,
    targetNode: state.targetNode,
    openContextMenu,
    closeContextMenu,
  };
}
