import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownViewer } from './MarkdownViewer';

// Mock the markdown transformation utilities
vi.mock('@/lib/markdown/remark-wikilinks', () => ({
  transformWikilinks: vi.fn((content: string) => content),
}));

vi.mock('@/lib/markdown/callouts', () => ({
  transformCallouts: vi.fn((content: string) => content),
}));

describe('MarkdownViewer', () => {
  it('renders basic markdown', () => {
    render(<MarkdownViewer content="# Hello\n\nWorld" vaultId="vault-1" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello');
    expect(screen.getByText(/World/)).toBeInTheDocument();
  });

  it('renders GFM tables', () => {
    const markdown = `
| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
    `;

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Column 1')).toBeInTheDocument();
    expect(screen.getByText('Value 1')).toBeInTheDocument();
  });

  it('renders code blocks with language label', () => {
    const markdown = '```javascript\nconst x = 1;\n```';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    // Text is broken up by syntax highlighting spans, check for parts
    expect(screen.getByText('const')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    // Check that code element has the language class
    const codeElement = screen.getByText('const').closest('code');
    expect(codeElement).toHaveClass('language-javascript');
  });

  it('renders inline code with proper styling', () => {
    const markdown = 'This is `inline code` here.';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    const code = screen.getByText('inline code');
    expect(code.tagName).toBe('CODE');
    expect(code).toHaveClass('rounded', 'bg-zinc-100');
  });

  it('adds target="_blank" to external links', () => {
    const markdown = '[External](https://example.com)';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    const link = screen.getByRole('link', { name: /External/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not add target="_blank" to internal links', () => {
    const markdown = '[Internal](/internal/page)';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    const link = screen.getByRole('link', { name: /Internal/ });
    expect(link).not.toHaveAttribute('target');
  });

  it('strips script tags for XSS prevention', () => {
    const markdown = '# Title\n\n<script>alert("xss")</script>\n\nSafe content';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    expect(screen.queryByText(/alert/)).not.toBeInTheDocument();
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('strips iframe tags', () => {
    const markdown = '<iframe src="evil.com"></iframe>\n\nSafe content';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    expect(screen.queryByTitle('iframe')).not.toBeInTheDocument();
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('allows safe HTML elements', () => {
    const markdown = '<div>Allowed div</div>\n\n<mark>Highlighted</mark>';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    expect(screen.getByText('Allowed div')).toBeInTheDocument();
    expect(screen.getByText('Highlighted')).toBeInTheDocument();
  });

  it('renders task list checkboxes', () => {
    const markdown = '- [x] Done\n- [ ] Todo';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('renders images with lazy loading', () => {
    const markdown = '![Alt text](https://example.com/image.png)';

    render(<MarkdownViewer content={markdown} vaultId="vault-1" />);

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('alt', 'Alt text');
  });
});
