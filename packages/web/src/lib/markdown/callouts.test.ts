import { describe, it, expect } from 'vitest';
import { transformCallouts, CALLOUT_TYPES } from './callouts';

describe('transformCallouts', () => {
  describe('basic callout transformation', () => {
    it('transforms note callout with title', () => {
      const markdown = '> [!note] Important Information\n> This is the content';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-note"');
      expect(result).toContain('data-callout="note"');
      expect(result).toContain('<div class="callout-title">');
      expect(result).toContain('data-icon="pencil"');
      expect(result).toContain('<span>Important Information</span>');
      expect(result).toContain('<div class="callout-content">');
      expect(result).toContain('This is the content');
    });

    it('transforms callout without title using default label', () => {
      const markdown = '> [!warning]\n> Be careful!';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-warning"');
      expect(result).toContain('<span>Warning</span>');
      expect(result).toContain('Be careful!');
    });

    it('transforms callout with empty content', () => {
      const markdown = '> [!info] Just a title';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-info"');
      expect(result).toContain('<span>Just a title</span>');
      expect(result).not.toContain('<div class="callout-content">');
    });

    it('transforms callout with multiline content', () => {
      const markdown = '> [!tip] Pro Tips\n> Line 1\n> Line 2\n> Line 3';
      const result = transformCallouts(markdown);

      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });
  });

  describe('callout type aliases', () => {
    it('transforms hint as tip alias', () => {
      const markdown = '> [!hint] Helpful info\n> Content here';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-hint"');
      expect(result).toContain('data-icon="flame"');
      expect(result).toContain('<span>Helpful info</span>');
    });

    it('transforms caution as warning alias', () => {
      const markdown = '> [!caution]\n> Be warned';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-caution"');
      expect(result).toContain('data-icon="alert-triangle"');
      expect(result).toContain('<span>Caution</span>');
    });

    it('transforms tldr as abstract alias', () => {
      const markdown = '> [!tldr]\n> Quick summary';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-tldr"');
      expect(result).toContain('data-icon="clipboard-list"');
      expect(result).toContain('<span>TL;DR</span>');
    });

    it('transforms check as success alias', () => {
      const markdown = '> [!check] Done\n> Task completed';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-check"');
      expect(result).toContain('data-icon="check"');
    });

    it('transforms faq as question alias', () => {
      const markdown = '> [!faq] Common question\n> Answer here';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-faq"');
      expect(result).toContain('data-icon="help-circle"');
    });

    it('transforms fail as failure alias', () => {
      const markdown = '> [!fail]\n> Something went wrong';
      const result = transformCallouts(markdown);

      expect(result).toContain('<div class="callout callout-fail"');
      expect(result).toContain('data-icon="x"');
    });
  });

  describe('all callout types', () => {
    it('has configuration for all documented types', () => {
      const expectedTypes = [
        'note', 'tip', 'warning', 'danger', 'info', 'example', 'quote',
        'abstract', 'todo', 'success', 'question', 'failure', 'bug',
        'important', 'caution'
      ];

      expectedTypes.forEach(type => {
        expect(CALLOUT_TYPES[type]).toBeDefined();
        expect(CALLOUT_TYPES[type].icon).toBeTruthy();
        expect(CALLOUT_TYPES[type].label).toBeTruthy();
      });
    });

    it('transforms danger callout', () => {
      const markdown = '> [!danger] Critical\n> Danger zone';
      const result = transformCallouts(markdown);
      expect(result).toContain('callout-danger');
      expect(result).toContain('data-icon="zap"');
    });

    it('transforms example callout', () => {
      const markdown = '> [!example]\n> Code sample';
      const result = transformCallouts(markdown);
      expect(result).toContain('callout-example');
      expect(result).toContain('data-icon="list"');
    });

    it('transforms bug callout', () => {
      const markdown = '> [!bug] Known Issue\n> Bug description';
      const result = transformCallouts(markdown);
      expect(result).toContain('callout-bug');
      expect(result).toContain('data-icon="bug"');
    });
  });

  describe('code fence exclusion', () => {
    it('does not transform callout syntax inside code blocks', () => {
      const markdown = [
        '```markdown',
        '> [!note] This should not transform',
        '> Content here',
        '```',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).not.toContain('<div class="callout');
      expect(result).toContain('> [!note] This should not transform');
      expect(result).toContain('```markdown');
    });

    it('transforms callouts before and after code blocks', () => {
      const markdown = [
        '> [!tip] Before',
        '> First callout',
        '',
        '```js',
        '> [!note] Not a callout',
        '```',
        '',
        '> [!warning] After',
        '> Second callout',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).toContain('callout-tip');
      expect(result).toContain('First callout');
      expect(result).toContain('callout-warning');
      expect(result).toContain('Second callout');
      expect(result).toContain('> [!note] Not a callout');
    });

    it('handles multiple code blocks', () => {
      const markdown = [
        '> [!info] Real callout',
        '> Content',
        '',
        '```',
        '> [!fake] Not transformed',
        '```',
        '',
        'Regular text',
        '',
        '```python',
        '# Code with > [!note] syntax',
        '```',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).toContain('callout-info');
      expect(result.match(/> \[!fake\]/g)).toHaveLength(1);
      expect(result.match(/> \[!note\]/g)).toHaveLength(1);
    });
  });

  describe('nested and complex content', () => {
    it('handles callout with nested markdown formatting', () => {
      const markdown = [
        '> [!note] Formatted Content',
        '> This has **bold** and *italic* text',
        '> And a [link](https://example.com)',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).toContain('callout-note');
      expect(result).toContain('**bold**');
      expect(result).toContain('*italic*');
      expect(result).toContain('[link](https://example.com)');
    });

    it('handles callout with code inside content', () => {
      const markdown = [
        '> [!tip] Code Example',
        '> Use `console.log()` for debugging',
        '> Or try `debugger` statement',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).toContain('callout-tip');
      expect(result).toContain('`console.log()`');
      expect(result).toContain('`debugger`');
    });

    it('handles callout with list content', () => {
      const markdown = [
        '> [!todo] Tasks',
        '> - [ ] First task',
        '> - [x] Done task',
        '> - [ ] Another task',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).toContain('callout-todo');
      expect(result).toContain('- [ ] First task');
      expect(result).toContain('- [x] Done task');
    });

    it('handles empty lines within callout content', () => {
      const markdown = [
        '> [!info] Multi-paragraph',
        '> First paragraph',
        '>',
        '> Second paragraph',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).toContain('callout-info');
      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
    });

    it('stops at non-blockquote line', () => {
      const markdown = [
        '> [!note] Callout',
        '> Content line 1',
        '> Content line 2',
        'Not part of callout',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).toContain('callout-note');
      expect(result).toContain('Content line 1');
      expect(result).toContain('Content line 2');
      expect(result).toContain('Not part of callout');
      // Ensure "Not part" is outside the callout div
      const calloutEndIndex = result.indexOf('</div>');
      const notPartIndex = result.indexOf('Not part of callout');
      expect(notPartIndex).toBeGreaterThan(calloutEndIndex);
    });
  });

  describe('case sensitivity and unknown types', () => {
    it('handles case-insensitive callout types', () => {
      const markdown = '> [!NOTE] Uppercase\n> Content';
      const result = transformCallouts(markdown);

      expect(result).toContain('callout-note');
    });

    it('does not transform unknown callout types', () => {
      const markdown = '> [!unknown] Custom Type\n> Some content';
      const result = transformCallouts(markdown);

      expect(result).not.toContain('<div class="callout');
      expect(result).toContain('> [!unknown]');
    });

    it('leaves non-callout blockquotes unchanged', () => {
      const markdown = '> Regular blockquote\n> Just a quote';
      const result = transformCallouts(markdown);

      expect(result).not.toContain('<div class="callout');
      expect(result).toContain('> Regular blockquote');
    });
  });

  describe('edge cases', () => {
    it('handles empty markdown string', () => {
      const result = transformCallouts('');
      expect(result).toBe('');
    });

    it('handles markdown with no callouts', () => {
      const markdown = 'Just regular text\nWith multiple lines';
      const result = transformCallouts(markdown);
      expect(result).toBe(markdown);
    });

    it('handles multiple callouts separated by non-blockquote line', () => {
      const markdown = [
        '> [!note] First',
        '> Note content',
        '',
        'Regular text breaks the blockquote',
        '',
        '> [!warning] Second',
        '> Warning content',
      ].join('\n');

      const result = transformCallouts(markdown);

      expect(result).toContain('callout-note');
      expect(result).toContain('callout-warning');
      expect(result).toContain('Note content');
      expect(result).toContain('Warning content');
      expect(result).toContain('Regular text breaks the blockquote');
    });

    it('handles callout with special characters in title', () => {
      const markdown = '> [!info] Title with "quotes" & symbols!\n> Content';
      const result = transformCallouts(markdown);

      expect(result).toContain('callout-info');
      expect(result).toContain('Title with "quotes" & symbols!');
    });

    it('handles callout at end of document', () => {
      const markdown = 'Some text\n\n> [!note] Final Note\n> Last content';
      const result = transformCallouts(markdown);

      expect(result).toContain('callout-note');
      expect(result).toContain('Last content');
    });
  });
});
