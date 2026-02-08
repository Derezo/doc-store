import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sanitizeSnippet, formatRelativeDate, formatFileSize, formatBytes } from './utils';

describe('sanitizeSnippet', () => {
  it('escapes HTML entities', () => {
    const html = '<script>alert("xss")</script>';
    const result = sanitizeSnippet(html);
    expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  it('restores <mark> tags', () => {
    const html = 'This is <mark>highlighted</mark> text';
    const result = sanitizeSnippet(html);
    expect(result).toBe('This is <mark>highlighted</mark> text');
  });

  it('restores </mark> closing tags', () => {
    const html = '<mark>test</mark>';
    const result = sanitizeSnippet(html);
    expect(result).toBe('<mark>test</mark>');
  });

  it('handles nested malicious tags within mark tags', () => {
    const html = '<mark><script>alert("xss")</script></mark>';
    const result = sanitizeSnippet(html);
    expect(result).toBe('<mark>&lt;script&gt;alert("xss")&lt;/script&gt;</mark>');
  });

  it('prevents XSS with img tags', () => {
    const html = '<img src=x onerror=alert("xss")>';
    const result = sanitizeSnippet(html);
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('handles mixed content with marks and XSS attempts', () => {
    const html = 'Safe <mark>highlighted</mark> and <script>unsafe</script>';
    const result = sanitizeSnippet(html);
    expect(result).toContain('<mark>highlighted</mark>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('is case insensitive for mark tags', () => {
    const html = '<MARK>test</MARK> and <MaRk>another</mArK>';
    const result = sanitizeSnippet(html);
    expect(result).toBe('<mark>test</mark> and <mark>another</mark>');
  });
});

describe('formatRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));
  });

  it('returns "just now" for dates less than 1 minute ago', () => {
    const date = new Date('2025-01-15T11:59:30.000Z').toISOString();
    expect(formatRelativeDate(date)).toBe('just now');
  });

  it('returns minutes ago for dates less than 1 hour ago', () => {
    const date = new Date('2025-01-15T11:45:00.000Z').toISOString();
    expect(formatRelativeDate(date)).toBe('15m ago');
  });

  it('returns hours ago for dates less than 24 hours ago', () => {
    const date = new Date('2025-01-15T09:00:00.000Z').toISOString();
    expect(formatRelativeDate(date)).toBe('3h ago');
  });

  it('returns days ago for dates less than 7 days ago', () => {
    const date = new Date('2025-01-12T12:00:00.000Z').toISOString();
    expect(formatRelativeDate(date)).toBe('3d ago');
  });

  it('returns formatted date for dates 7 days or more ago (same year)', () => {
    const date = new Date('2025-01-01T12:00:00.000Z').toISOString();
    const result = formatRelativeDate(date);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/1/);
    expect(result).not.toMatch(/2025/); // Same year, no year shown
  });

  it('returns formatted date with year for dates in different year', () => {
    const date = new Date('2024-12-25T12:00:00.000Z').toISOString();
    const result = formatRelativeDate(date);
    expect(result).toMatch(/Dec/);
    expect(result).toMatch(/25/);
    expect(result).toMatch(/2024/); // Different year, year shown
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });

  it('handles exactly 1KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('handles exactly 1MB', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });
});

describe('formatBytes', () => {
  it('handles 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes without decimal', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1572864)).toBe('1.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1610612736)).toBe('1.5 GB');
  });

  it('handles exactly 1KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
  });
});
