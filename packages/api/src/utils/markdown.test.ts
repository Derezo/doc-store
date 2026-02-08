import { describe, it, expect } from 'vitest';
import {
  extractFrontmatter,
  extractTitle,
  extractTags,
  stripMarkdown,
} from './markdown.js';

describe('extractFrontmatter', () => {
  it('should parse YAML frontmatter', () => {
    const content = `---
title: Test Doc
author: John Doe
---
# Content here`;
    const result = extractFrontmatter(content);
    expect(result.data.title).toBe('Test Doc');
    expect(result.data.author).toBe('John Doe');
    expect(result.content).toBe('# Content here');
  });

  it('should handle missing frontmatter', () => {
    const content = '# Just a heading\nSome content';
    const result = extractFrontmatter(content);
    expect(result.data).toEqual({});
    expect(result.content).toBe('# Just a heading\nSome content');
  });

  it('should handle invalid YAML gracefully', () => {
    const content = `---
invalid: [unclosed
---
# Content`;
    const result = extractFrontmatter(content);
    expect(result.data).toEqual({});
    expect(result.content).toBe(content);
  });

  it('should handle empty frontmatter', () => {
    const content = `---
---
# Content`;
    const result = extractFrontmatter(content);
    expect(result.data).toEqual({});
    expect(result.content).toBe('# Content');
  });

  it('should handle frontmatter with arrays', () => {
    const content = `---
tags:
  - javascript
  - typescript
---
Content`;
    const result = extractFrontmatter(content);
    expect(result.data.tags).toEqual(['javascript', 'typescript']);
  });
});

describe('extractTitle', () => {
  it('should extract title from frontmatter', () => {
    const data = { title: 'My Title' };
    const content = '# Another heading';
    expect(extractTitle(data, content)).toBe('My Title');
  });

  it('should extract title from first H1 heading', () => {
    const data = {};
    const content = '# My Heading\n\nSome content';
    expect(extractTitle(data, content)).toBe('My Heading');
  });

  it('should prefer frontmatter title over H1', () => {
    const data = { title: 'Frontmatter Title' };
    const content = '# H1 Heading';
    expect(extractTitle(data, content)).toBe('Frontmatter Title');
  });

  it('should return null if no title found', () => {
    const data = {};
    const content = 'Just some text without headings';
    expect(extractTitle(data, content)).toBeNull();
  });

  it('should trim whitespace from title', () => {
    const data = { title: '  Spaced Title  ' };
    const content = '';
    expect(extractTitle(data, content)).toBe('Spaced Title');
  });

  it('should ignore non-string frontmatter title', () => {
    const data = { title: 123 };
    const content = '# Real Heading';
    expect(extractTitle(data, content)).toBe('Real Heading');
  });

  it('should extract H1 with special characters', () => {
    const data = {};
    const content = '# Title with **bold** and *italic*';
    expect(extractTitle(data, content)).toBe('Title with **bold** and *italic*');
  });
});

describe('extractTags', () => {
  it('should extract tags from frontmatter array', () => {
    const data = { tags: ['javascript', 'web'] };
    const content = '';
    const result = extractTags(data, content);
    expect(result).toEqual(['javascript', 'web']);
  });

  it('should extract inline #tags from content', () => {
    const data = {};
    const content = 'This is #javascript and #typescript content';
    const result = extractTags(data, content);
    expect(result).toEqual(['javascript', 'typescript']);
  });

  it('should deduplicate tags', () => {
    const data = { tags: ['javascript'] };
    const content = 'More #javascript content';
    const result = extractTags(data, content);
    expect(result).toEqual(['javascript']);
  });

  it('should normalize tags to lowercase', () => {
    const data = { tags: ['JavaScript'] };
    const content = '#TypeScript content';
    const result = extractTags(data, content);
    expect(result).toEqual(['javascript', 'typescript']);
  });

  it('should exclude tags inside code blocks', () => {
    const data = {};
    const content = `Normal #tag1
\`\`\`
#code-tag
\`\`\`
Another #tag2`;
    const result = extractTags(data, content);
    expect(result).toEqual(['tag1', 'tag2']);
  });

  it('should exclude tags inside inline code', () => {
    const data = {};
    const content = 'This #real but `#notreal` is not';
    const result = extractTags(data, content);
    expect(result).toEqual(['real']);
  });

  it('should not match heading markers as tags', () => {
    const data = {};
    const content = '## Heading\n#validtag content';
    const result = extractTags(data, content);
    expect(result).toEqual(['validtag']);
  });

  it('should handle empty frontmatter tags', () => {
    const data = { tags: [] };
    const content = '#tag1 #tag2';
    const result = extractTags(data, content);
    expect(result).toEqual(['tag1', 'tag2']);
  });

  it('should handle non-array frontmatter tags', () => {
    const data = { tags: 'not-an-array' };
    const content = '#tag1';
    const result = extractTags(data, content);
    expect(result).toEqual(['tag1']);
  });

  it('should skip empty string tags from frontmatter', () => {
    const data = { tags: ['valid', '', '  ', 'another'] };
    const content = '';
    const result = extractTags(data, content);
    expect(result).toEqual(['another', 'valid']);
  });

  it('should match tags with hyphens and numbers', () => {
    const data = {};
    const content = '#tag-1 and #tag2-name';
    const result = extractTags(data, content);
    expect(result).toEqual(['tag-1', 'tag2-name']);
  });

  it('should sort tags alphabetically', () => {
    const data = {};
    const content = '#zebra #apple #banana';
    const result = extractTags(data, content);
    expect(result).toEqual(['apple', 'banana', 'zebra']);
  });
});

describe('stripMarkdown', () => {
  it('should remove heading markers', () => {
    const content = '# H1\n## H2\n### H3';
    expect(stripMarkdown(content)).toBe('H1\nH2\nH3');
  });

  it('should remove bold emphasis', () => {
    const content = 'This is **bold** text';
    expect(stripMarkdown(content)).toBe('This is bold text');
  });

  it('should remove italic emphasis', () => {
    const content = 'This is *italic* text';
    expect(stripMarkdown(content)).toBe('This is italic text');
  });

  it('should remove links but keep text', () => {
    const content = '[link text](https://example.com)';
    expect(stripMarkdown(content)).toBe('link text');
  });

  it('should remove images but keep alt text', () => {
    const content = '![alt text](image.png)';
    expect(stripMarkdown(content)).toBe('alt text');
  });

  it('should remove code blocks', () => {
    const content = 'Before\n```js\ncode here\n```\nAfter';
    expect(stripMarkdown(content)).toBe('Before\n\nAfter');
  });

  it('should preserve inline code content', () => {
    const content = 'Use `const` keyword';
    expect(stripMarkdown(content)).toBe('Use const keyword');
  });

  it('should remove list markers', () => {
    const content = '- Item 1\n- Item 2\n1. Numbered';
    expect(stripMarkdown(content)).toBe('Item 1\nItem 2\nNumbered');
  });

  it('should remove blockquote markers', () => {
    const content = '> This is a quote';
    expect(stripMarkdown(content)).toBe('This is a quote');
  });

  it('should remove horizontal rules', () => {
    const content = 'Before\n---\nAfter';
    expect(stripMarkdown(content)).toBe('Before\n\nAfter');
  });

  it('should remove strikethrough', () => {
    const content = '~~deleted text~~';
    expect(stripMarkdown(content)).toBe('deleted text');
  });

  it('should remove HTML tags', () => {
    const content = '<div>content</div>';
    expect(stripMarkdown(content)).toBe('content');
  });

  it('should collapse multiple newlines', () => {
    const content = 'Line 1\n\n\n\nLine 2';
    expect(stripMarkdown(content)).toBe('Line 1\n\nLine 2');
  });

  it('should trim whitespace', () => {
    const content = '  \n\n  Content  \n\n  ';
    expect(stripMarkdown(content)).toBe('Content');
  });

  it('should handle complex markdown', () => {
    const content = `# Title

**Bold** and *italic* text with [links](url).

- List item
- Another item

\`\`\`
code block
\`\`\`

> Quote

---`;
    const result = stripMarkdown(content);
    expect(result).toContain('Title');
    expect(result).toContain('Bold');
    expect(result).toContain('italic');
    expect(result).toContain('links');
    expect(result).not.toContain('**');
    expect(result).not.toContain('*');
    expect(result).not.toContain('[');
    expect(result).not.toContain('```');
  });
});
