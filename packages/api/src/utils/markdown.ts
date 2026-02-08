import matter from 'gray-matter';

/**
 * Parse YAML frontmatter from markdown content.
 * Returns the parsed data object and the content without frontmatter.
 */
export function extractFrontmatter(content: string): {
  data: Record<string, any>;
  content: string;
} {
  try {
    const parsed = matter(content);
    return {
      data: parsed.data as Record<string, any>,
      content: parsed.content,
    };
  } catch {
    // If frontmatter parsing fails, return empty data and original content
    return { data: {}, content };
  }
}

/**
 * Extract a title from frontmatter or the first H1 heading.
 * Returns null if no title is found.
 */
export function extractTitle(
  frontmatterData: Record<string, any>,
  content: string,
): string | null {
  // 1. Check frontmatter for a title field
  if (frontmatterData.title && typeof frontmatterData.title === 'string') {
    return frontmatterData.title.trim();
  }

  // 2. Look for the first H1 heading in the content
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return null;
}

/**
 * Extract tags from frontmatter and inline #tag patterns in content.
 * Deduplicates and normalises to lowercase.
 */
export function extractTags(
  frontmatterData: Record<string, any>,
  content: string,
): string[] {
  const tagSet = new Set<string>();

  // 1. Tags from frontmatter
  if (Array.isArray(frontmatterData.tags)) {
    for (const tag of frontmatterData.tags) {
      if (typeof tag === 'string' && tag.trim()) {
        tagSet.add(tag.trim().toLowerCase());
      }
    }
  }

  // 2. Inline #tag patterns (not inside code blocks or headings)
  // Remove code blocks first to avoid matching tags inside them
  const withoutCode = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');

  // Match #tag patterns: preceded by whitespace or start of line,
  // not followed by another # (to avoid matching headings)
  const tagPattern = /(?:^|\s)#([a-zA-Z][\w-]*)/g;
  let match;
  while ((match = tagPattern.exec(withoutCode)) !== null) {
    tagSet.add(match[1].toLowerCase());
  }

  return Array.from(tagSet).sort();
}

/**
 * Strip markdown syntax to produce plain text suitable for search indexing.
 * Removes: headers, links, images, code blocks, emphasis, horizontal rules, etc.
 */
export function stripMarkdown(content: string): string {
  let text = content;

  // Remove code blocks (fenced)
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove inline code
  text = text.replace(/`([^`]*)`/g, '$1');

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove links but keep text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove reference-style links
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');

  // Remove heading markers
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove emphasis (bold, italic)
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/___(.+?)___/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');
  text = text.replace(/_(.+?)_/g, '$1');

  // Remove strikethrough
  text = text.replace(/~~(.+?)~~/g, '$1');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove blockquotes
  text = text.replace(/^>\s?/gm, '');

  // Remove list markers
  text = text.replace(/^[\s]*[-+*]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim
  text = text.trim();

  return text;
}
