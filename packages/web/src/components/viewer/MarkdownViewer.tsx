'use client';

import { useMemo, useState, useCallback, useRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeRaw from 'rehype-raw';

// Extended sanitization schema: allow rehype-raw HTML through but block scripts/iframes
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'mark', 'div', 'span', 'details', 'summary',
    'sup', 'sub', 'abbr', 'kbd', 'var', 'samp',
  ],
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), 'className', 'class'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className', 'class'],
    code: [...(defaultSchema.attributes?.code ?? []), 'className', 'class'],
    pre: [...(defaultSchema.attributes?.pre ?? []), 'className', 'class'],
    a: [...(defaultSchema.attributes?.a ?? []), 'href', 'target', 'rel'],
    img: [...(defaultSchema.attributes?.img ?? []), 'src', 'alt', 'loading'],
  },
};
import { transformWikilinks } from '@/lib/markdown/remark-wikilinks';
import { transformCallouts } from '@/lib/markdown/callouts';
import {
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
  vaultId: string;
  className?: string;
}

/**
 * Beautiful Markdown renderer with full Obsidian-compatible feature set.
 *
 * Supports:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
 * - LaTeX math (inline $...$ and display $$...$$)
 * - YAML frontmatter (hidden from output)
 * - Syntax-highlighted code blocks with copy button and language label
 * - Obsidian-style [[wikilinks]]
 * - Obsidian-style callout blocks (> [!type])
 * - Dark mode via Tailwind Typography
 */
export function MarkdownViewer({ content, vaultId, className }: MarkdownViewerProps) {
  // Preprocess: transform wikilinks and callouts before parsing
  const processedContent = useMemo(() => {
    let result = content;
    result = transformWikilinks(result, vaultId);
    result = transformCallouts(result);
    return result;
  }, [content, vaultId]);

  const components = useMemo<Components>(() => ({
    // Wrap fenced code blocks with language header and copy button.
    // react-markdown renders fenced blocks as <pre><code class="language-xxx">...</code></pre>.
    // rehype-highlight processes the <code> children into highlighted spans.
    pre({ children, ...props }) {
      // Extract language and text content from the inner <code> element
      const codeChild = extractCodeChild(children);

      if (codeChild) {
        return (
          <CodeBlock
            language={codeChild.language}
            codeElement={codeChild.element}
          />
        );
      }

      // Fallback for pre elements without a code child
      return <pre {...props}>{children}</pre>;
    },

    // Inline code only — block code is handled by the `pre` component above
    code({ className, children, ...props }) {
      // If it has a language class, it's inside a <pre> and the pre handler
      // will take care of rendering. Return the code as-is.
      if (className && /language-/.test(className)) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }

      return (
        <code
          className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.875em] dark:bg-zinc-800"
          {...props}
        >
          {children}
        </code>
      );
    },

    // Tables with horizontal scroll wrapper
    table({ children, ...props }) {
      return (
        <div className="overflow-x-auto">
          <table {...props}>{children}</table>
        </div>
      );
    },

    // Links: internal links stay in-app, external links open in new tab
    a({ href, children, ...props }) {
      const isExternal = href?.startsWith('http://') || href?.startsWith('https://');

      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
          {isExternal && (
            <ExternalLink className="ml-1 inline-block h-3 w-3 opacity-50" />
          )}
        </a>
      );
    },

    // Images with lazy loading
    img({ src, alt, ...props }) {
      return (
        <img
          src={src}
          alt={alt ?? ''}
          loading="lazy"
          className="rounded-lg"
          {...props}
        />
      );
    },

    // Task list checkboxes
    input({ type, checked, ...props }) {
      if (type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={checked}
            readOnly
            className="mr-2 h-4 w-4 rounded border-zinc-300 text-blue-600 dark:border-zinc-600"
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },
  }), []);

  return (
    <div className={`prose prose-zinc dark:prose-invert max-w-none ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkFrontmatter]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeHighlight, rehypeKatex]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Code block with language label + copy button
// ---------------------------------------------------------------------------

interface CodeChildInfo {
  language: string | null;
  element: React.ReactElement;
}

/**
 * Extract the <code> child from a <pre> element's children.
 * Returns the language (if any) and the React element.
 */
function extractCodeChild(children: React.ReactNode): CodeChildInfo | null {
  // children of <pre> is typically a single <code> React element
  const child = Array.isArray(children) ? children[0] : children;

  if (
    child &&
    typeof child === 'object' &&
    'props' in child &&
    (child as any).type === 'code'
  ) {
    const element = child as React.ReactElement<any>;
    const className: string = element.props?.className ?? '';
    const match = /language-(\w+)/.exec(className);
    return {
      language: match ? match[1] : null,
      element,
    };
  }

  return null;
}

function CodeBlock({
  language,
  codeElement,
}: {
  language: string | null;
  codeElement: React.ReactElement;
}) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(async () => {
    // Extract text from the rendered DOM for accurate copy
    const text = preRef.current?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API might not be available
    }
  }, []);

  return (
    <div className="not-prose my-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-1.5 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {language ?? 'text'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <pre ref={preRef} className="m-0 overflow-x-auto rounded-none border-0 p-4 text-sm leading-relaxed">
        {codeElement}
      </pre>
    </div>
  );
}

export default MarkdownViewer;
