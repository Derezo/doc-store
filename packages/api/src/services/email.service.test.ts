import { describe, it, expect } from 'vitest';
import { escapeHtml } from './email.service.js';

describe('escapeHtml', () => {
  it('should escape ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape less than', () => {
    expect(escapeHtml('5 < 10')).toBe('5 &lt; 10');
  });

  it('should escape greater than', () => {
    expect(escapeHtml('10 > 5')).toBe('10 &gt; 5');
  });

  it('should escape double quotes', () => {
    expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeHtml("It's working")).toBe("It&#039;s working");
  });

  it('should handle already-safe string unchanged', () => {
    expect(escapeHtml('Safe text')).toBe('Safe text');
  });

  it('should escape multiple characters', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
