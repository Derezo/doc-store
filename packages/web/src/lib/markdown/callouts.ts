/**
 * Preprocessor for Obsidian-style callout blocks.
 *
 * Transforms:
 *   > [!note] Title
 *   > Content here
 *   > More content
 *
 * Into HTML that can be styled with CSS:
 *   <div class="callout callout-note">
 *     <div class="callout-title">
 *       <span class="callout-icon">{icon}</span>
 *       <span>Title</span>
 *     </div>
 *     <div class="callout-content">
 *
 *   Content here
 *   More content
 *
 *   </div>
 *   </div>
 *
 * Supported types: note, tip, warning, danger, info, example, quote, abstract,
 * todo, success, question, failure, bug, important, caution
 */

export interface CalloutConfig {
  icon: string;
  label: string;
}

export const CALLOUT_TYPES: Record<string, CalloutConfig> = {
  note: { icon: 'pencil', label: 'Note' },
  tip: { icon: 'flame', label: 'Tip' },
  hint: { icon: 'flame', label: 'Hint' },
  important: { icon: 'alert-circle', label: 'Important' },
  warning: { icon: 'alert-triangle', label: 'Warning' },
  caution: { icon: 'alert-triangle', label: 'Caution' },
  danger: { icon: 'zap', label: 'Danger' },
  info: { icon: 'info', label: 'Info' },
  example: { icon: 'list', label: 'Example' },
  quote: { icon: 'quote', label: 'Quote' },
  cite: { icon: 'quote', label: 'Cite' },
  abstract: { icon: 'clipboard-list', label: 'Abstract' },
  summary: { icon: 'clipboard-list', label: 'Summary' },
  tldr: { icon: 'clipboard-list', label: 'TL;DR' },
  todo: { icon: 'check-circle-2', label: 'Todo' },
  success: { icon: 'check', label: 'Success' },
  check: { icon: 'check', label: 'Check' },
  done: { icon: 'check', label: 'Done' },
  question: { icon: 'help-circle', label: 'Question' },
  help: { icon: 'help-circle', label: 'Help' },
  faq: { icon: 'help-circle', label: 'FAQ' },
  failure: { icon: 'x', label: 'Failure' },
  fail: { icon: 'x', label: 'Fail' },
  missing: { icon: 'x', label: 'Missing' },
  bug: { icon: 'bug', label: 'Bug' },
};

/**
 * Transform Obsidian callout blockquotes into HTML div structures.
 * Must be run before passing to react-markdown.
 */
export function transformCallouts(markdown: string): string {
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Track code fences
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      i++;
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      i++;
      continue;
    }

    // Check for callout start: > [!type] Optional Title
    const calloutMatch = line.match(
      /^>\s*\[!(\w+)\]\s*(.*)?$/,
    );

    if (calloutMatch) {
      const type = calloutMatch[1].toLowerCase();
      const title = calloutMatch[2]?.trim() || '';
      const config = CALLOUT_TYPES[type];

      if (config) {
        // Collect all continuation lines (lines starting with >)
        const contentLines: string[] = [];
        i++;
        while (i < lines.length) {
          const nextLine = lines[i];
          // Lines starting with > are part of the blockquote
          if (nextLine.startsWith('>')) {
            // Strip the leading > and optional space
            contentLines.push(nextLine.replace(/^>\s?/, ''));
            i++;
          } else if (nextLine.trim() === '') {
            // Empty line might end the blockquote
            // Check if next non-empty line continues the blockquote
            const lookAhead = i + 1;
            if (lookAhead < lines.length && lines[lookAhead].startsWith('>')) {
              contentLines.push('');
              i++;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        const displayTitle = title || config.label;
        const content = contentLines.join('\n').trim();

        result.push(`<div class="callout callout-${type}" data-callout="${type}">`);
        result.push(`<div class="callout-title">`);
        result.push(`<span class="callout-icon" data-icon="${config.icon}"></span>`);
        result.push(`<span>${displayTitle}</span>`);
        result.push(`</div>`);
        if (content) {
          result.push(`<div class="callout-content">`);
          result.push('');
          result.push(content);
          result.push('');
          result.push(`</div>`);
        }
        result.push(`</div>`);
        result.push('');
        continue;
      }
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
}
