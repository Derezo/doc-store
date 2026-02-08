'use client';

import { Eye, Pencil, Code2 } from 'lucide-react';
import type { EditorMode } from '@/lib/stores/editor.store';

interface EditorModeToggleProps {
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
  hasUnsavedChanges?: boolean;
}

const modes: { value: EditorMode; icon: typeof Eye; label: string }[] = [
  { value: 'view', icon: Eye, label: 'View' },
  { value: 'edit', icon: Pencil, label: 'Edit' },
  { value: 'source', icon: Code2, label: 'Source' },
];

export function EditorModeToggle({
  mode,
  onChange,
  hasUnsavedChanges,
}: EditorModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <span className="h-2 w-2 rounded-full bg-amber-400" title="Unsaved changes" />
      )}

      {/* Segmented control */}
      <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
        {modes.map(({ value, icon: Icon, label }) => {
          const isActive = mode === value;
          return (
            <button
              key={value}
              onClick={() => onChange(value)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default EditorModeToggle;
