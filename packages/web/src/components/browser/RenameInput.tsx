'use client';

import { useEffect, useRef, useState } from 'react';

export interface RenameInputProps {
  currentName: string;
  isFile: boolean;
  onSubmit: (_newName: string) => void;
  onCancel: () => void;
}

/**
 * Inline rename input for file tree items.
 * Auto-focuses and selects text on mount.
 */
export function RenameInput({ currentName, isFile, onSubmit, onCancel }: RenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Strip .md extension for display in files
  const displayName = isFile ? currentName.replace(/\.md$/i, '') : currentName;
  const [value, setValue] = useState(displayName);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }

    // For files, the parent will add .md extension if needed
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSubmit}
      className="flex-1 rounded border border-blue-500 bg-white px-2 py-0.5 text-sm text-zinc-900 outline-none dark:bg-zinc-800 dark:text-zinc-100"
      onClick={(e) => e.stopPropagation()}
    />
  );
}
