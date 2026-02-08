/**
 * Remark plugin to transform Obsidian-style [[wikilinks]] into standard markdown links.
 *
 * Transforms:
 *   [[page name]]           -> [page name](/vaults/{vaultId}/page-name.md)
 *   [[page name|display]]   -> [display](/vaults/{vaultId}/page-name.md)
 *   [[folder/page]]         -> [page](/vaults/{vaultId}/folder/page.md)
 *
 * This works as a text preprocessor rather than a full remark AST plugin,
 * since wikilinks are not valid Markdown syntax and need to be transformed
 * before the parser sees them.
 */

/**
 * Preprocess markdown text to convert wikilinks to standard links.
 */
export function transformWikilinks(
  markdown: string,
  vaultId: string,
): string {
  // Match [[...]] but not inside code blocks or inline code
  // We'll process line by line to handle code fences
  const lines = markdown.split('\n');
  let inCodeBlock = false;
  const result: string[] = [];

  for (const line of lines) {
    // Track code fence boundaries
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Transform wikilinks in non-code lines, but skip inline code
    result.push(transformWikilinksInLine(line, vaultId));
  }

  return result.join('\n');
}

function transformWikilinksInLine(line: string, vaultId: string): string {
  // Split by inline code spans to avoid transforming inside them
  const parts = line.split(/(`[^`]+`)/);
  return parts
    .map((part, i) => {
      // Odd-indexed parts are inline code spans — leave them alone
      if (i % 2 === 1) return part;

      // Transform wikilinks in regular text
      return part.replace(
        /\[\[([^\]]+)\]\]/g,
        (_match, inner: string) => {
          const pipeIndex = inner.indexOf('|');
          let target: string;
          let display: string;

          if (pipeIndex !== -1) {
            target = inner.substring(0, pipeIndex).trim();
            display = inner.substring(pipeIndex + 1).trim();
          } else {
            target = inner.trim();
            display = target;
            // If target has a path, show only the filename as display
            if (target.includes('/')) {
              display = target.split('/').pop() ?? target;
            }
          }

          // Build the URL path
          const urlPath = normalizeWikilinkTarget(target);

          return `[${display}](/vaults/${vaultId}/${urlPath})`;
        },
      );
    })
    .join('');
}

/**
 * Normalize a wikilink target into a URL-safe path.
 * "Some Page" -> "Some Page.md"
 * "folder/Some Page" -> "folder/Some Page.md"
 * "page.md" -> "page.md" (already has extension)
 */
function normalizeWikilinkTarget(target: string): string {
  // If it already has a file extension, use as-is
  if (/\.\w+$/.test(target)) {
    return target;
  }

  // Otherwise, append .md
  return `${target}.md`;
}
