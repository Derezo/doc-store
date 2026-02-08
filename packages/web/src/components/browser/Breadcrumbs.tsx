'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  vaultId: string;
  vaultName: string;
  /** Document path like "folder/subfolder/file.md" */
  path?: string;
}

interface BreadcrumbSegment {
  label: string;
  href: string;
}

/**
 * Breadcrumb navigation showing: Vaults > Vault Name > folder > subfolder > file.md
 * Each segment is clickable for navigation.
 */
export function Breadcrumbs({ vaultId, vaultName, path }: BreadcrumbsProps) {
  const segments = buildBreadcrumbs(vaultId, vaultName, path);

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
      <Link
        href="/vaults"
        className="flex items-center text-zinc-400 transition-colors hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
      >
        <Home className="h-4 w-4" />
      </Link>

      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={segment.href} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" />
            {isLast ? (
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {segment.label}
              </span>
            ) : (
              <Link
                href={segment.href}
                className="text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {segment.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function buildBreadcrumbs(
  vaultId: string,
  vaultName: string,
  path?: string,
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [
    { label: vaultName, href: `/vaults/${vaultId}` },
  ];

  if (!path) return segments;

  const parts = path.split('/').filter(Boolean);
  let currentPath = '';

  for (let i = 0; i < parts.length; i++) {
    currentPath += (i > 0 ? '/' : '') + parts[i];
    const label = i === parts.length - 1
      ? parts[i].replace(/\.md$/i, '')
      : parts[i];

    segments.push({
      label,
      href: `/vaults/${vaultId}/${currentPath}`,
    });
  }

  return segments;
}

export default Breadcrumbs;
