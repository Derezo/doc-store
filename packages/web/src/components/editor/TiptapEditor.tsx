'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { EditorToolbar } from './EditorToolbar';

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: string;
  onChange: (_markdown: string) => void;
  editable?: boolean;
}

// Configure turndown for better markdown output
function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  // Strikethrough
  td.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: (content) => `~~${content}~~`,
  });

  // Task list items
  td.addRule('taskListItem', {
    filter: (node) => {
      return (
        node.nodeName === 'LI' &&
        node.getAttribute('data-type') === 'taskItem'
      );
    },
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
      const prefix = checked ? '- [x] ' : '- [ ] ';
      return prefix + content.trim() + '\n';
    },
  });

  // Tables — use GFM pipe tables
  td.addRule('tableCell', {
    filter: ['th', 'td'],
    replacement: (content) => {
      return ` ${content.trim()} |`;
    },
  });

  td.addRule('tableRow', {
    filter: 'tr',
    replacement: (content) => {
      return `|${content}\n`;
    },
  });

  td.addRule('table', {
    filter: 'table',
    replacement: (_content, node) => {
      const element = node as HTMLTableElement;
      const rows = Array.from(element.querySelectorAll('tr'));
      if (rows.length === 0) return '';

      const lines: string[] = [];

      rows.forEach((row, index) => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        const cellTexts = cells.map((cell) => ` ${cell.textContent?.trim() ?? ''} `);
        lines.push(`|${cellTexts.join('|')}|`);

        // Add separator after header row
        if (index === 0) {
          const separator = cells.map(() => ' --- ');
          lines.push(`|${separator.join('|')}|`);
        }
      });

      return '\n' + lines.join('\n') + '\n';
    },
  });

  return td;
}

const turndownService = createTurndownService();

/**
 * Convert Markdown to HTML using marked (synchronous).
 */
function markdownToHtml(markdown: string): string {
  // marked.parse can return string or Promise depending on config;
  // with default sync config it returns string
  const result = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  return result as string;
}

/**
 * Convert HTML back to Markdown using turndown.
 */
function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}

export function TiptapEditor({ content, onChange, editable = true }: TiptapEditorProps) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef(false);
  const lastMarkdownRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We use CodeBlockLowlight instead
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline dark:text-blue-400',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Typography,
      Underline,
    ],
    content: markdownToHtml(content),
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-6 py-4',
      },
    },
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;

      // Debounce the markdown conversion
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        const html = editor.getHTML();
        const markdown = htmlToMarkdown(html);
        lastMarkdownRef.current = markdown;
        onChange(markdown);
      }, 300);
    },
  });

  // Update editor content when content prop changes (e.g., from server reload)
  useEffect(() => {
    if (!editor) return;
    if (content === lastMarkdownRef.current) return;

    isUpdatingRef.current = true;
    lastMarkdownRef.current = content;
    const html = markdownToHtml(content);
    editor.commands.setContent(html);
    isUpdatingRef.current = false;
  }, [content, editor]);

  // Update editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editable, editor]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  if (!editor) return null;

  return (
    <div className="flex flex-col">
      {editable && <EditorToolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default TiptapEditor;
