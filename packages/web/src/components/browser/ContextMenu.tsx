'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ContextMenuProps {
  position: { x: number; y: number };
  items: (ContextMenuItem | 'separator')[];
  onClose: () => void;
}

/**
 * Generic context menu component.
 * Renders via portal, positions absolutely, handles keyboard navigation.
 */
export function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Get valid items (excluding separators) for keyboard navigation
  const validItems = items.filter((item): item is ContextMenuItem => item !== 'separator');

  // Adjust position to prevent overflow
  useEffect(() => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // Clamp to viewport bounds
    if (x + rect.width > viewportWidth) {
      x = Math.max(10, viewportWidth - rect.width - 10);
    }

    if (y + rect.height > viewportHeight) {
      y = Math.max(10, viewportHeight - rect.height - 10);
    }

    setAdjustedPosition({ x, y });
  }, [position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Small delay to prevent immediate close from the triggering click
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => {
            const nextIndex = prev + 1;
            // Skip disabled items
            let idx = nextIndex % validItems.length;
            while (validItems[idx]?.disabled && idx !== prev) {
              idx = (idx + 1) % validItems.length;
            }
            return idx;
          });
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => {
            const nextIndex = prev - 1 < 0 ? validItems.length - 1 : prev - 1;
            // Skip disabled items
            let idx = nextIndex;
            while (validItems[idx]?.disabled && idx !== prev) {
              idx = idx - 1 < 0 ? validItems.length - 1 : idx - 1;
            }
            return idx;
          });
          break;

        case 'Enter':
          e.preventDefault();
          const item = validItems[selectedIndex];
          if (item && !item.disabled) {
            item.onClick();
            onClose();
          }
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, validItems, onClose]);

  let validItemIndex = -1;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {items.map((item, index) => {
        if (item === 'separator') {
          return (
            <div
              key={`separator-${index}`}
              className="my-1 border-t border-zinc-200 dark:border-zinc-700"
            />
          );
        }

        validItemIndex++;
        const isSelected = validItemIndex === selectedIndex;
        const isDanger = item.variant === 'danger';

        return (
          <button
            key={index}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`
              flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors
              ${isSelected && !item.disabled ? 'bg-zinc-100 dark:bg-zinc-700' : ''}
              ${
                isDanger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }
              ${item.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
            `}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
