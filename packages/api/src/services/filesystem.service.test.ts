import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  validatePath,
  validateDirPath,
  writeFile,
  readFile,
  deleteFile,
  listFiles,
  getVaultPath,
} from './filesystem.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

const TEST_DIR = `/tmp/doc-store-test-fs-${Date.now()}`;

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});

describe('validatePath', () => {
  it('should accept valid .md path', () => {
    expect(() => validatePath('notes/test.md')).not.toThrow();
  });

  it('should reject path with null bytes', () => {
    expect(() => validatePath('test\0file.md')).toThrow(ValidationError);
    expect(() => validatePath('test\0file.md')).toThrow('null bytes');
  });

  it('should reject path with backslashes', () => {
    expect(() => validatePath('folder\\test.md')).toThrow(ValidationError);
    expect(() => validatePath('folder\\test.md')).toThrow('backslashes');
  });

  it('should reject path with directory traversal', () => {
    expect(() => validatePath('../test.md')).toThrow(ValidationError);
    expect(() => validatePath('folder/../test.md')).toThrow(ValidationError);
    expect(() => validatePath('folder/../test.md')).toThrow('traversal');
  });

  it('should reject path not ending in .md', () => {
    expect(() => validatePath('test.txt')).toThrow(ValidationError);
    expect(() => validatePath('test')).toThrow(ValidationError);
    expect(() => validatePath('test.txt')).toThrow('.md');
  });

  it('should reject empty path', () => {
    expect(() => validatePath('')).toThrow(ValidationError);
    expect(() => validatePath('  ')).toThrow(ValidationError);
  });

  it('should reject path starting with /', () => {
    expect(() => validatePath('/test.md')).toThrow(ValidationError);
    expect(() => validatePath('/test.md')).toThrow('must not start with /');
  });

  it('should reject path with empty segments', () => {
    expect(() => validatePath('folder//test.md')).toThrow(ValidationError);
    expect(() => validatePath('folder//test.md')).toThrow('empty segments');
  });
});

describe('validateDirPath', () => {
  it('should accept valid directory path', () => {
    expect(() => validateDirPath('notes/subfolder')).not.toThrow();
  });

  it('should accept empty path for root directory', () => {
    expect(() => validateDirPath('')).not.toThrow();
    expect(() => validateDirPath('  ')).not.toThrow();
  });

  it('should reject path with null bytes', () => {
    expect(() => validateDirPath('test\0folder')).toThrow(ValidationError);
  });

  it('should reject path with backslashes', () => {
    expect(() => validateDirPath('folder\\subfolder')).toThrow(ValidationError);
  });

  it('should reject path with directory traversal', () => {
    expect(() => validateDirPath('../folder')).toThrow(ValidationError);
    expect(() => validateDirPath('folder/..')).toThrow(ValidationError);
  });

  it('should not require .md extension', () => {
    expect(() => validateDirPath('folder')).not.toThrow();
  });

  it('should reject path starting with /', () => {
    expect(() => validateDirPath('/folder')).toThrow(ValidationError);
  });

  it('should reject path with empty segments', () => {
    expect(() => validateDirPath('folder//subfolder')).toThrow(ValidationError);
  });
});

describe('writeFile and readFile', () => {
  it('should write and read a file', async () => {
    const content = 'Test content';
    await writeFile(TEST_DIR, 'test.md', content);
    const readContent = await readFile(TEST_DIR, 'test.md');
    expect(readContent).toBe(content);
  });

  it('should create intermediate directories', async () => {
    const content = 'Nested content';
    await writeFile(TEST_DIR, 'folder/subfolder/nested.md', content);
    const readContent = await readFile(TEST_DIR, 'folder/subfolder/nested.md');
    expect(readContent).toBe(content);
  });

  it('should overwrite existing file', async () => {
    await writeFile(TEST_DIR, 'overwrite.md', 'Original');
    await writeFile(TEST_DIR, 'overwrite.md', 'Updated');
    const content = await readFile(TEST_DIR, 'overwrite.md');
    expect(content).toBe('Updated');
  });

  it('should throw NotFoundError for nonexistent file', async () => {
    await expect(readFile(TEST_DIR, 'nonexistent.md')).rejects.toThrow(NotFoundError);
    await expect(readFile(TEST_DIR, 'nonexistent.md')).rejects.toThrow('not found');
  });
});

describe('deleteFile', () => {
  it('should delete an existing file', async () => {
    await writeFile(TEST_DIR, 'todelete.md', 'Content');
    await deleteFile(TEST_DIR, 'todelete.md');
    await expect(readFile(TEST_DIR, 'todelete.md')).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError for nonexistent file', async () => {
    await expect(deleteFile(TEST_DIR, 'doesnotexist.md')).rejects.toThrow(NotFoundError);
  });

  it('should clean up empty parent directories', async () => {
    await writeFile(TEST_DIR, 'cleanup/folder/file.md', 'Content');
    await deleteFile(TEST_DIR, 'cleanup/folder/file.md');

    // Check that empty directories were removed
    const cleanupPath = path.join(TEST_DIR, 'cleanup');
    await expect(fs.access(cleanupPath)).rejects.toThrow();
  });
});

describe('listFiles', () => {
  it('should list files in directory', async () => {
    const testDir = path.join(TEST_DIR, 'listtest');
    await fs.mkdir(testDir, { recursive: true });

    await writeFile(testDir, 'file1.md', 'Content 1');
    await writeFile(testDir, 'file2.md', 'Content 2');
    await writeFile(testDir, 'subfolder/file3.md', 'Content 3');

    const files = await listFiles(testDir);
    const filePaths = files.filter(f => !f.isDirectory).map(f => f.path);

    expect(filePaths).toContain('file1.md');
    expect(filePaths).toContain('file2.md');
    expect(filePaths).toContain('subfolder/file3.md');
  });

  it('should skip hidden files', async () => {
    const testDir = path.join(TEST_DIR, 'hiddentest');
    await fs.mkdir(testDir, { recursive: true });

    await writeFile(testDir, 'visible.md', 'Content');
    await fs.writeFile(path.join(testDir, '.hidden.md'), 'Hidden');

    const files = await listFiles(testDir);
    const filePaths = files.map(f => f.path);

    expect(filePaths).toContain('visible.md');
    expect(filePaths).not.toContain('.hidden.md');
  });

  it('should include directories in listing', async () => {
    const testDir = path.join(TEST_DIR, 'dirtest');
    await fs.mkdir(testDir, { recursive: true });

    await writeFile(testDir, 'folder/file.md', 'Content');

    const files = await listFiles(testDir);
    const dirs = files.filter(f => f.isDirectory);

    expect(dirs.length).toBeGreaterThan(0);
    expect(dirs[0].path).toBe('folder');
  });
});
