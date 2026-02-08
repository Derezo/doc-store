import { describe, it, expect } from 'vitest';
import { transformWikilinks } from './remark-wikilinks';

describe('transformWikilinks', () => {
  const vaultId = 'test-vault-123';

  describe('basic wikilink resolution', () => {
    it('transforms simple wikilink to markdown link', () => {
      const markdown = '[[page name]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[page name](/vaults/test-vault-123/page name.md)');
    });

    it('transforms wikilink with spaces', () => {
      const markdown = 'Check out [[My Document]] for details';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[My Document](/vaults/test-vault-123/My Document.md)');
      expect(result).toContain('Check out');
      expect(result).toContain('for details');
    });

    it('transforms multiple wikilinks in one line', () => {
      const markdown = 'See [[First Page]] and [[Second Page]] for info';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[First Page](/vaults/test-vault-123/First Page.md)');
      expect(result).toContain('[Second Page](/vaults/test-vault-123/Second Page.md)');
    });

    it('preserves wikilink with existing .md extension', () => {
      const markdown = '[[document.md]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[document.md](/vaults/test-vault-123/document.md)');
    });
  });

  describe('display text alias', () => {
    it('transforms wikilink with pipe alias', () => {
      const markdown = '[[actual-page|Display Text]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[Display Text](/vaults/test-vault-123/actual-page.md)');
    });

    it('handles alias with spaces', () => {
      const markdown = '[[technical-name|Human Readable Title]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[Human Readable Title](/vaults/test-vault-123/technical-name.md)');
    });

    it('trims whitespace around alias parts', () => {
      const markdown = '[[ page-name | Display Name ]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[Display Name](/vaults/test-vault-123/page-name.md)');
    });

    it('handles empty alias after pipe', () => {
      const markdown = '[[page-name|]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[](/vaults/test-vault-123/page-name.md)');
    });
  });

  describe('path handling', () => {
    it('transforms wikilink with folder path', () => {
      const markdown = '[[folder/document]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[document](/vaults/test-vault-123/folder/document.md)');
    });

    it('transforms wikilink with nested folder path', () => {
      const markdown = '[[folder/subfolder/page]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[page](/vaults/test-vault-123/folder/subfolder/page.md)');
    });

    it('shows only filename as display text for paths', () => {
      const markdown = 'See [[docs/guides/setup]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[setup](/vaults/test-vault-123/docs/guides/setup.md)');
    });

    it('preserves path with alias', () => {
      const markdown = '[[folder/technical-doc|Easy Guide]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[Easy Guide](/vaults/test-vault-123/folder/technical-doc.md)');
    });

    it('handles path with existing extension', () => {
      const markdown = '[[folder/doc.md]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[doc.md](/vaults/test-vault-123/folder/doc.md)');
    });
  });

  describe('code exclusion', () => {
    it('does not transform wikilinks inside code fences', () => {
      const markdown = [
        '```markdown',
        '[[not-a-link]]',
        '```',
      ].join('\n');

      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[[not-a-link]]');
      expect(result).not.toContain('(/vaults/');
    });

    it('does not transform wikilinks inside inline code', () => {
      const markdown = 'Use `[[page]]` syntax for links';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('Use `[[page]]` syntax for links');
    });

    it('transforms wikilinks outside code but preserves inside', () => {
      const markdown = 'See [[Real Link]] or use `[[syntax]]` in code';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[Real Link](/vaults/test-vault-123/Real Link.md)');
      expect(result).toContain('`[[syntax]]`');
    });

    it('handles multiple inline code spans', () => {
      const markdown = '`[[first]]` normal [[link]] and `[[second]]`';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[link](/vaults/test-vault-123/link.md)');
      expect(result).toContain('`[[first]]`');
      expect(result).toContain('`[[second]]`');
    });

    it('transforms before and after code blocks', () => {
      const markdown = [
        '[[Before Link]]',
        '',
        '```',
        '[[inside code]]',
        '```',
        '',
        '[[After Link]]',
      ].join('\n');

      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[Before Link](/vaults/test-vault-123/Before Link.md)');
      expect(result).toContain('[After Link](/vaults/test-vault-123/After Link.md)');
      expect(result).toContain('[[inside code]]');
    });

    it('handles code fence with language identifier', () => {
      const markdown = [
        '```javascript',
        'const link = "[[not-transformed]]";',
        '```',
      ].join('\n');

      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[[not-transformed]]');
    });
  });

  describe('multiline handling', () => {
    it('transforms wikilinks on multiple lines', () => {
      const markdown = [
        'Line 1 with [[Page One]]',
        'Line 2 with [[Page Two]]',
        'Line 3 with [[Page Three]]',
      ].join('\n');

      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[Page One](/vaults/test-vault-123/Page One.md)');
      expect(result).toContain('[Page Two](/vaults/test-vault-123/Page Two.md)');
      expect(result).toContain('[Page Three](/vaults/test-vault-123/Page Three.md)');
    });

    it('preserves line structure', () => {
      const markdown = [
        'First line',
        '[[Link on second]]',
        '',
        'Fourth line',
      ].join('\n');

      const result = transformWikilinks(markdown, vaultId);
      const lines = result.split('\n');

      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('First line');
      expect(lines[2]).toBe('');
      expect(lines[3]).toBe('Fourth line');
    });
  });

  describe('edge cases', () => {
    it('handles empty markdown string', () => {
      const result = transformWikilinks('', vaultId);
      expect(result).toBe('');
    });

    it('handles markdown with no wikilinks', () => {
      const markdown = 'Just regular text with [normal link](url)';
      const result = transformWikilinks(markdown, vaultId);
      expect(result).toBe(markdown);
    });

    it('handles wikilink with special characters', () => {
      const markdown = '[[page-with-dashes_and_underscores]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[page-with-dashes_and_underscores](/vaults/test-vault-123/page-with-dashes_and_underscores.md)');
    });

    it('handles wikilink with numbers', () => {
      const markdown = '[[2024-01-15 Meeting Notes]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[2024-01-15 Meeting Notes](/vaults/test-vault-123/2024-01-15 Meeting Notes.md)');
    });

    it('does not handle nested brackets in wikilink syntax (limitation)', () => {
      // The regex [^\]]+ stops at first ] character
      // So [[page|Text [with] brackets]] won't match the full wikilink
      const markdown = '[[page|Text [with] brackets]]';
      const result = transformWikilinks(markdown, vaultId);

      // The wikilink won't be transformed due to the nested brackets
      expect(result).toBe('[[page|Text [with] brackets]]');
    });

    it('handles file extensions other than .md', () => {
      const markdown = '[[document.pdf]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[document.pdf](/vaults/test-vault-123/document.pdf)');
    });

    it('handles wikilink at start of line', () => {
      const markdown = '[[First Thing]] to read';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('[First Thing](/vaults/test-vault-123/First Thing.md) to read');
    });

    it('handles wikilink at end of line', () => {
      const markdown = 'Related: [[Last Thing]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('Related: [Last Thing](/vaults/test-vault-123/Last Thing.md)');
    });

    it('uses provided vault ID in URL', () => {
      const markdown = '[[page]]';
      const customVaultId = 'custom-vault-xyz';
      const result = transformWikilinks(markdown, customVaultId);

      expect(result).toBe('[page](/vaults/custom-vault-xyz/page.md)');
    });
  });

  describe('integration with markdown syntax', () => {
    it('works alongside regular markdown links', () => {
      const markdown = 'See [[wiki]] or [regular](https://example.com)';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[wiki](/vaults/test-vault-123/wiki.md)');
      expect(result).toContain('[regular](https://example.com)');
    });

    it('works with bold and italic text', () => {
      const markdown = '**Bold with [[link]]** and *italic [[another]]*';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('**Bold with [link](/vaults/test-vault-123/link.md)**');
      expect(result).toContain('*italic [another](/vaults/test-vault-123/another.md)*');
    });

    it('works in list items', () => {
      const markdown = [
        '- Item with [[Link One]]',
        '- Another with [[Link Two]]',
      ].join('\n');

      const result = transformWikilinks(markdown, vaultId);

      expect(result).toContain('[Link One](/vaults/test-vault-123/Link One.md)');
      expect(result).toContain('[Link Two](/vaults/test-vault-123/Link Two.md)');
    });

    it('works in headings', () => {
      const markdown = '# Heading with [[Wiki Link]]';
      const result = transformWikilinks(markdown, vaultId);

      expect(result).toBe('# Heading with [Wiki Link](/vaults/test-vault-123/Wiki Link.md)');
    });
  });
});
