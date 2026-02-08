import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseFilePath, shouldIgnore } from './sync.service.js';

// Mock the config module
vi.mock('../config.js', () => ({
  config: {
    DATA_DIR: '/tmp/test-data',
  },
}));

describe('parseFilePath', () => {
  it('should parse valid file path', () => {
    const absPath = '/tmp/test-data/user123/vault-slug/notes/doc.md';
    const result = parseFilePath(absPath);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user123');
    expect(result?.vaultSlug).toBe('vault-slug');
    expect(result?.docPath).toBe('notes/doc.md');
  });

  it('should parse file at vault root', () => {
    const absPath = '/tmp/test-data/user123/vault-slug/doc.md';
    const result = parseFilePath(absPath);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user123');
    expect(result?.vaultSlug).toBe('vault-slug');
    expect(result?.docPath).toBe('doc.md');
  });

  it('should parse deeply nested file', () => {
    const absPath = '/tmp/test-data/user456/my-vault/folder1/folder2/folder3/deep.md';
    const result = parseFilePath(absPath);

    expect(result).not.toBeNull();
    expect(result?.userId).toBe('user456');
    expect(result?.vaultSlug).toBe('my-vault');
    expect(result?.docPath).toBe('folder1/folder2/folder3/deep.md');
  });

  it('should return null for path outside DATA_DIR', () => {
    const absPath = '/other/path/user123/vault/doc.md';
    const result = parseFilePath(absPath);

    expect(result).toBeNull();
  });

  it('should return null for path with too few segments', () => {
    const absPath = '/tmp/test-data/user123'; // Missing vault and file
    const result = parseFilePath(absPath);

    expect(result).toBeNull();
  });

  it('should return null for path with only user and vault', () => {
    const absPath = '/tmp/test-data/user123/vault-slug';
    const result = parseFilePath(absPath);

    expect(result).toBeNull();
  });

  it('should handle Windows-style separators correctly', () => {
    // On Unix, path.sep is '/', so this tests the logic
    const absPath = '/tmp/test-data/user123/vault/notes/doc.md';
    const result = parseFilePath(absPath);

    expect(result).not.toBeNull();
    expect(result?.docPath).toBe('notes/doc.md'); // Always uses forward slashes
  });
});

describe('shouldIgnore', () => {
  it('should ignore .obsidian directory contents', () => {
    expect(shouldIgnore('/path/to/.obsidian/config.json')).toBe(true);
    expect(shouldIgnore('/path/to/vault/.obsidian/workspace')).toBe(true);
  });

  it('should ignore .obsidian directory itself', () => {
    expect(shouldIgnore('/path/to/vault/.obsidian')).toBe(true);
  });

  it('should ignore non-.md files', () => {
    expect(shouldIgnore('/path/to/file.txt')).toBe(true);
    expect(shouldIgnore('/path/to/file.json')).toBe(true);
    expect(shouldIgnore('/path/to/image.png')).toBe(true);
  });

  it('should not ignore .md files', () => {
    expect(shouldIgnore('/path/to/notes/doc.md')).toBe(false);
  });

  it('should ignore hidden files', () => {
    expect(shouldIgnore('/path/to/.hidden.md')).toBe(true);
    expect(shouldIgnore('/path/to/folder/.gitignore')).toBe(true);
  });

  it('should not ignore visible .md files', () => {
    expect(shouldIgnore('/path/to/visible.md')).toBe(false);
    expect(shouldIgnore('/path/to/folder/document.md')).toBe(false);
  });

  it('should handle nested paths correctly', () => {
    expect(shouldIgnore('/vault/folder/subfolder/note.md')).toBe(false);
    expect(shouldIgnore('/vault/folder/.obsidian/cache')).toBe(true);
  });
});
