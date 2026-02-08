'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useVault } from '@/hooks/useVault';
import { useDocument } from '@/hooks/useDocument';
import { FileTree } from '@/components/browser/FileTree';
import { Breadcrumbs } from '@/components/browser/Breadcrumbs';
import { MarkdownViewer } from '@/components/viewer/MarkdownViewer';
import { api } from '@/lib/api-client';
import type { DocumentListItem } from '@doc-store/shared';
import {
  Loader2,
  FileText,
  Clock,
  BookOpen,
} from 'lucide-react';

/**
 * Vault root page: shows vault overview with file tree listing
 * and README.md content if it exists.
 */
export default function VaultBrowserPage() {
  const params = useParams();
  const vaultId = params.vaultId as string;
  const { currentVault, tree, treeLoading, loading } = useVault(vaultId);
  const [documentCount, setDocumentCount] = useState<number | null>(null);

  // Try to load README.md for the vault
  const { content: readmeContent, loading: readmeLoading } = useDocument(
    vaultId,
    'README.md',
  );

  // Fetch document count
  useEffect(() => {
    if (vaultId) {
      api
        .get(`api/v1/vaults/${vaultId}/documents`)
        .json<{ documents: DocumentListItem[] }>()
        .then((data) => setDocumentCount(data.documents.length))
        .catch(() => setDocumentCount(null));
    }
  }, [vaultId]);

  if (loading || !currentVault) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading vault...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header area */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <Breadcrumbs vaultId={vaultId} vaultName={currentVault.name} />

        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {currentVault.name}
            </h1>
            {currentVault.description && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {currentVault.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
            {documentCount !== null && (
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {documentCount} {documentCount === 1 ? 'document' : 'documents'}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Updated {new Date(currentVault.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* README.md content if available */}
        {readmeContent && !readmeLoading && (
          <div className="mb-8">
            <MarkdownViewer content={readmeContent} vaultId={vaultId} />
          </div>
        )}

        {/* File listing as a grid when no README */}
        {!readmeContent && !readmeLoading && (
          <VaultFileList
            tree={tree ?? []}
            treeLoading={treeLoading}
            vaultId={vaultId}
          />
        )}
      </div>
    </div>
  );
}

function VaultFileList({
  tree,
  treeLoading,
  vaultId,
}: {
  tree: import('@doc-store/shared').TreeNode[];
  treeLoading: boolean;
  vaultId: string;
}) {
  if (treeLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
        <BookOpen className="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
        <h3 className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Empty vault
        </h3>
        <p className="mt-1 max-w-sm text-center text-sm text-zinc-500 dark:text-zinc-400">
          Add documents via the API or sync from Obsidian to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Files
      </h2>
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <FileTree tree={tree} vaultId={vaultId} />
      </div>
    </div>
  );
}
