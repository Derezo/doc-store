'use client';

import { useParams } from 'next/navigation';
import { useVault } from '@/hooks/useVault';
import { useDocument } from '@/hooks/useDocument';
import { Breadcrumbs } from '@/components/browser/Breadcrumbs';
import { MarkdownViewer } from '@/components/viewer/MarkdownViewer';
import {
  Loader2,
  FileText,
  Clock,
  AlertCircle,
  Eye,
  Pencil,
  Code2,
} from 'lucide-react';

/**
 * Document view page.
 * Supports three view modes: View, Edit, Source.
 * Phase 4 implements View mode; Edit and Source are placeholders for Phase 5.
 */
export default function DocumentPage() {
  const params = useParams();
  const vaultId = params.vaultId as string;
  const pathSegments = params.path as string[];
  const docPath = pathSegments.join('/');

  const { currentVault } = useVault(vaultId);
  const { document: doc, content, loading, error } = useDocument(vaultId, docPath);

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

          {/* View mode tabs */}
          <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
            <ViewModeTab icon={Eye} label="View" active />
            <ViewModeTab icon={Pencil} label="Edit" disabled />
            <ViewModeTab icon={Code2} label="Source" disabled />
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

      {/* Document content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <MarkdownViewer content={content} vaultId={vaultId} />
        </div>
      </div>
    </div>
  );
}

function ViewModeTab({
  icon: Icon,
  label,
  active = false,
  disabled = false,
}: {
  icon: typeof Eye;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
          : disabled
            ? 'cursor-not-allowed text-zinc-300 dark:text-zinc-600'
            : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

function extractFileName(path: string): string {
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.md$/i, '');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
