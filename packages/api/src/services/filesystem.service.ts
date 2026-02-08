import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

/**
 * Validate a relative file path for safety.
 * Throws if the path contains traversal sequences, null bytes,
 * backslashes, starts with /, is empty, or doesn't end in .md.
 */
export function validatePath(relativePath: string): void {
  if (!relativePath || relativePath.trim() === '') {
    throw new ValidationError('Path cannot be empty');
  }

  if (relativePath.includes('\0')) {
    throw new ValidationError('Path contains null bytes');
  }

  if (relativePath.includes('\\')) {
    throw new ValidationError('Path contains backslashes');
  }

  if (relativePath.startsWith('/')) {
    throw new ValidationError('Path must not start with /');
  }

  // Check for path traversal
  const segments = relativePath.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      throw new ValidationError('Path contains directory traversal');
    }
    if (segment === '') {
      // double slashes
      throw new ValidationError('Path contains empty segments');
    }
  }

  if (!relativePath.endsWith('.md')) {
    throw new ValidationError('Path must end with .md');
  }
}

/**
 * Validate a directory path for listing operations.
 * Same as validatePath but doesn't require .md extension.
 */
export function validateDirPath(relativePath: string): void {
  if (!relativePath || relativePath.trim() === '') {
    return; // empty path = root dir, that's fine
  }

  if (relativePath.includes('\0')) {
    throw new ValidationError('Path contains null bytes');
  }

  if (relativePath.includes('\\')) {
    throw new ValidationError('Path contains backslashes');
  }

  if (relativePath.startsWith('/')) {
    throw new ValidationError('Path must not start with /');
  }

  const segments = relativePath.split('/');
  for (const segment of segments) {
    if (segment === '..') {
      throw new ValidationError('Path contains directory traversal');
    }
    if (segment === '') {
      throw new ValidationError('Path contains empty segments');
    }
  }
}

/**
 * Resolve and verify that a path stays within the vault directory.
 * Returns the resolved absolute path.
 */
function resolveSafePath(basePath: string, relativePath: string): string {
  const resolved = path.resolve(basePath, relativePath);
  if (!resolved.startsWith(path.resolve(basePath) + path.sep) && resolved !== path.resolve(basePath)) {
    throw new ValidationError('Path escapes vault directory');
  }
  return resolved;
}

/**
 * Get the absolute path for a vault directory.
 */
export function getVaultPath(userId: string, vaultSlug: string): string {
  return path.resolve(config.DATA_DIR, userId, vaultSlug);
}

/**
 * Create the vault directory if it doesn't exist.
 */
export async function ensureVaultDir(userId: string, vaultSlug: string): Promise<void> {
  const vaultPath = getVaultPath(userId, vaultSlug);
  await fs.mkdir(vaultPath, { recursive: true });
}

/**
 * Write a file atomically: write to a temp file, then rename.
 * Creates intermediate directories as needed.
 */
export async function writeFile(
  vaultPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  validatePath(relativePath);
  const absPath = resolveSafePath(vaultPath, relativePath);

  // Ensure parent directory exists
  const parentDir = path.dirname(absPath);
  await fs.mkdir(parentDir, { recursive: true });

  // Atomic write: write to temp file in same directory, then rename
  const tempFile = path.join(
    parentDir,
    `.tmp-${crypto.randomBytes(8).toString('hex')}`,
  );

  try {
    await fs.writeFile(tempFile, content, 'utf-8');
    await fs.rename(tempFile, absPath);
  } catch (err) {
    // Clean up temp file if rename failed
    try {
      await fs.unlink(tempFile);
    } catch {
      // ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Read a file's content.
 */
export async function readFile(
  vaultPath: string,
  relativePath: string,
): Promise<string> {
  validatePath(relativePath);
  const absPath = resolveSafePath(vaultPath, relativePath);

  try {
    return await fs.readFile(absPath, 'utf-8');
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new NotFoundError(`File not found: ${relativePath}`);
    }
    throw err;
  }
}

/**
 * Delete a file.
 */
export async function deleteFile(
  vaultPath: string,
  relativePath: string,
): Promise<void> {
  validatePath(relativePath);
  const absPath = resolveSafePath(vaultPath, relativePath);

  try {
    await fs.unlink(absPath);
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new NotFoundError(`File not found: ${relativePath}`);
    }
    throw err;
  }

  // Clean up empty parent directories (up to vault root)
  let dir = path.dirname(absPath);
  const vaultRoot = path.resolve(vaultPath);
  while (dir !== vaultRoot && dir.startsWith(vaultRoot)) {
    try {
      await fs.rmdir(dir);
      dir = path.dirname(dir);
    } catch {
      // Directory not empty or other error — stop cleaning
      break;
    }
  }
}

/**
 * List files in a directory recursively.
 */
export async function listFiles(
  vaultPath: string,
  relativePath?: string,
): Promise<FileEntry[]> {
  if (relativePath) {
    validateDirPath(relativePath);
  }

  const basePath = relativePath
    ? resolveSafePath(vaultPath, relativePath)
    : path.resolve(vaultPath);

  const entries: FileEntry[] = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    let dirEntries;
    try {
      dirEntries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return; // directory doesn't exist yet
      }
      throw err;
    }

    for (const entry of dirEntries) {
      // Skip hidden files and temp files
      if (entry.name.startsWith('.')) continue;

      const entryRelPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absEntryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        entries.push({
          name: entry.name,
          path: entryRelPath,
          isDirectory: true,
          size: 0,
          modifiedAt: new Date().toISOString(),
        });
        await walk(absEntryPath, entryRelPath);
      } else {
        const stat = await fs.stat(absEntryPath);
        entries.push({
          name: entry.name,
          path: entryRelPath,
          isDirectory: false,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }
  }

  await walk(basePath, relativePath ?? '');
  return entries;
}

/**
 * Check if a file exists.
 */
export async function fileExists(
  vaultPath: string,
  relativePath: string,
): Promise<boolean> {
  validatePath(relativePath);
  const absPath = resolveSafePath(vaultPath, relativePath);

  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete an entire vault directory recursively.
 */
export async function deleteVaultDir(userId: string, vaultSlug: string): Promise<void> {
  const vaultPath = getVaultPath(userId, vaultSlug);
  try {
    await fs.rm(vaultPath, { recursive: true, force: true });
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return; // already gone
    }
    throw err;
  }
}
