'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useVault } from '@/hooks/useVault';
import { useDocument } from '@/hooks/useDocument';
import { useEditorStore, type EditorMode } from '@/lib/stores/editor.store';
import { Breadcrumbs } from '@/components/browser/Breadcrumbs';
import { MarkdownViewer } from '@/components/viewer/MarkdownViewer';
import { formatFileSize } from '@/lib/utils';
import { EditorModeToggle } from '@/components/editor/EditorModeToggle';
import { api } from '@/lib/api-client';
import { useVaultStore } from '@/lib/stores/vault.store';
import {
  Loader2,
  FileText,
  Clock,
  AlertCircle,
  Save,
  Check,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

// Dynamic imports for heavy editor components (no SSR)
const TiptapEditor = dynamic(
  () => import('@/components/editor/TiptapEditor'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    ),
  },
);

const CodeMirrorEditor = dynamic(
  () => import('@/components/editor/CodeMirrorEditor'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    ),
  },
);

/**
 * Document view/edit page.
 * Supports three modes: View (MarkdownViewer), Edit (Tiptap WYSIWYG), Source (CodeMirror).
 * Features auto-save with debounce and conflict detection.
 */
export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const vaultId = params.vaultId as string;
  const pathSegments = params.path as string[];
  const docPath = pathSegments.join('/');

  const { currentVault } = useVault(vaultId);
  const { document: doc, content, loading, error } = useDocument(vaultId, docPath);
  const { fetchTree } = useVaultStore();

  const {
    mode,
    content: editorContent,
    isDirty,
    isSaving,
    saveError,
    lastSavedAt,
    setMode,
    setContent,
    loadDocument,
    save,
    reset,
  } = useEditorStore();

  const saveTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load document content into editor store when document loads
  useEffect(() => {
    if (doc && content !== null) {
      loadDocument(content, doc.contentHash);
    }
  }, [doc, content, loadDocument]);

  // Reset editor store when navigating away
  useEffect(() => {
    return () => {
      reset();
    };
  }, [docPath, reset]);

  // Auto-save handler
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);

      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounced save after 1.5s
      saveTimeoutRef.current = setTimeout(() => {
        save(vaultId, docPath);
      }, 1500);
    },
    [setContent, save, vaultId, docPath],
  );

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Save on mode change if dirty (save before switching)
  const handleModeChange = useCallback(
    (newMode: EditorMode) => {
      if (isDirty) {
        // Save current content before switching modes
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        save(vaultId, docPath);
      }
      setMode(newMode);
    },
    [isDirty, save, vaultId, docPath, setMode],
  );

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          save(vaultId, docPath);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, save, vaultId, docPath]);

  // Delete document handler
  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await api.delete(`api/v1/vaults/${vaultId}/documents/${docPath}`);
      // Refresh tree and navigate to vault root
      fetchTree(vaultId);
      router.push(`/vaults/${vaultId}`);
    } catch (err) {
      console.error('Failed to delete document:', err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [vaultId, docPath, router, fetchTree]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Document Not Found
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {error}
        </p>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Path: {docPath}
        </p>
      </div>
    );
  }

  if (!doc || content === null) {
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Document header */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        {currentVault && (
          <Breadcrumbs
            vaultId={vaultId}
            vaultName={currentVault.name}
            path={docPath}
          />
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-zinc-400" />
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {doc.title || extractFileName(docPath)}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Save status indicator */}
            <SaveStatusIndicator
              isDirty={isDirty}
              isSaving={isSaving}
              saveError={saveError}
              lastSavedAt={lastSavedAt}
              mode={mode}
            />

            {/* Mode toggle */}
            <EditorModeToggle
              mode={mode}
              onChange={handleModeChange}
              hasUnsavedChanges={isDirty}
            />

            {/* Delete button */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
              title="Delete document"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Document metadata */}
        <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Modified {new Date(doc.fileModifiedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span>{formatFileSize(doc.sizeBytes)}</span>
          {doc.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {doc.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document content area */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'view' && (
          <div className="mx-auto max-w-4xl px-6 py-8">
            <MarkdownViewer content={editorContent} vaultId={vaultId} />
          </div>
        )}

        {mode === 'edit' && (
          <div className="mx-auto max-w-4xl">
            <TiptapEditor
              content={editorContent}
              onChange={handleContentChange}
              editable
            />
          </div>
        )}

        {mode === 'source' && (
          <div className="h-full">
            <CodeMirrorEditor
              content={editorContent}
              onChange={handleContentChange}
              editable
            />
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <DeleteConfirmDialog
          fileName={extractFileName(docPath)}
          isDeleting={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save Status Indicator
// ---------------------------------------------------------------------------

function SaveStatusIndicator({
  isDirty,
  isSaving,
  saveError,
  lastSavedAt,
  mode,
}: {
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: Date | null;
  mode: EditorMode;
}) {
  // Only show in edit/source modes
  if (mode === 'view') return null;

  if (saveError) {
    return (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <AlertTriangle className="h-3 w-3" />
        <span>Save failed</span>
      </span>
    );
  }

  if (isSaving) {
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <Save className="h-3 w-3 animate-pulse" />
        <span>Saving...</span>
      </span>
    );
  }

  if (isDirty) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-500">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        <span>Unsaved changes</span>
      </span>
    );
  }

  if (lastSavedAt) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <Check className="h-3 w-3" />
        <span>Saved</span>
      </span>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Delete Confirmation Dialog
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  fileName,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  fileName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Delete document
            </h3>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
          Are you sure you want to delete{' '}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {fileName}
          </span>
          ?
        </p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function extractFileName(path: string): string {
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.md$/i, '');
}

