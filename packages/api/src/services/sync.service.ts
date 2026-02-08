import path from 'node:path';
import fs from 'node:fs/promises';
import { watch, type FSWatcher } from 'chokidar';
import { eq, and } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { users, vaults, documents } from '../db/schema.js';
import * as documentService from './document.service.js';
import { logger as rootLogger } from '../utils/logger.js';

const logger = rootLogger.child({ module: 'sync-service' });

/**
 * Debounce map: tracks pending file operations to avoid rapid duplicate processing.
 * Maps absolute file path -> timeout handle.
 */
const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Recently-written set: tracks files that were recently written by the API/WebDAV
 * to avoid double-processing when chokidar picks them up.
 * Maps absolute file path -> timestamp when it was marked.
 */
const recentlyWritten = new Map<string, number>();

const DEBOUNCE_MS = 500;
const RECENTLY_WRITTEN_TTL_MS = 5_000;
const RECONCILE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

let watcher: FSWatcher | null = null;
let reconcileTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Mark a file as recently written by the API/WebDAV.
 * The sync service will ignore chokidar events for this file for a short window.
 */
export function markRecentlyWritten(absPath: string): void {
  recentlyWritten.set(absPath, Date.now());
}

/**
 * Check and clear stale entries from the recently-written set.
 */
function isRecentlyWritten(absPath: string): boolean {
  const ts = recentlyWritten.get(absPath);
  if (!ts) return false;

  if (Date.now() - ts > RECENTLY_WRITTEN_TTL_MS) {
    recentlyWritten.delete(absPath);
    return false;
  }

  // Consume the entry (one-time bypass)
  recentlyWritten.delete(absPath);
  return true;
}

/**
 * Parse an absolute file path to extract userId, vaultSlug, and relative doc path.
 * Expected layout: DATA_DIR/{userId}/{vaultSlug}/{...docPath}
 *
 * Returns null if the path doesn't match the expected layout.
 */
function parseFilePath(
  absPath: string,
): { userId: string; vaultSlug: string; docPath: string } | null {
  const dataDir = path.resolve(config.DATA_DIR);
  if (!absPath.startsWith(dataDir + path.sep)) {
    return null;
  }

  const relative = absPath.slice(dataDir.length + 1); // strip DATA_DIR/
  const parts = relative.split(path.sep);

  // Need at least: userId / vaultSlug / someFile.md
  if (parts.length < 3) {
    return null;
  }

  const userId = parts[0];
  const vaultSlug = parts[1];
  const docPath = parts.slice(2).join('/'); // use forward slashes for doc paths

  return { userId, vaultSlug, docPath };
}

/**
 * Check if a path should be ignored by the watcher.
 * Ignores: .obsidian/ directory contents, non-.md files, hidden files.
 */
function shouldIgnore(absPath: string): boolean {
  // Skip .obsidian directories
  if (absPath.includes(`${path.sep}.obsidian${path.sep}`) || absPath.endsWith(`${path.sep}.obsidian`)) {
    return true;
  }

  // Only process .md files
  if (!absPath.endsWith('.md')) {
    return true;
  }

  // Skip hidden files (starting with .)
  const basename = path.basename(absPath);
  if (basename.startsWith('.')) {
    return true;
  }

  return false;
}

/**
 * Handle a file add or change event.
 */
async function handleFileChange(absPath: string): Promise<void> {
  if (shouldIgnore(absPath)) return;
  if (isRecentlyWritten(absPath)) {
    logger.debug({ path: absPath }, 'Skipping recently-written file');
    return;
  }

  const parsed = parseFilePath(absPath);
  if (!parsed) {
    logger.warn({ path: absPath }, 'Could not parse file path');
    return;
  }

  try {
    // Look up the vault
    const [vault] = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(and(eq(vaults.userId, parsed.userId), eq(vaults.slug, parsed.vaultSlug)))
      .limit(1);

    if (!vault) {
      logger.debug(
        { userId: parsed.userId, vaultSlug: parsed.vaultSlug },
        'Vault not found for filesystem change, skipping',
      );
      return;
    }

    // Read the file content
    const content = await fs.readFile(absPath, 'utf-8');

    // Upsert via document service
    await documentService.put(
      parsed.userId,
      vault.id,
      parsed.docPath,
      content,
      'webdav', // source = webdav since this comes from external filesystem changes
    );

    logger.debug({ path: parsed.docPath, vaultId: vault.id }, 'Synced file change to DB');
  } catch (err) {
    logger.error({ err, path: absPath }, 'Error syncing file change to DB');
  }
}

/**
 * Handle a file deletion event.
 */
async function handleFileDelete(absPath: string): Promise<void> {
  if (shouldIgnore(absPath)) return;
  if (isRecentlyWritten(absPath)) {
    logger.debug({ path: absPath }, 'Skipping recently-written file deletion');
    return;
  }

  const parsed = parseFilePath(absPath);
  if (!parsed) return;

  try {
    // Look up the vault
    const [vault] = await db
      .select({ id: vaults.id })
      .from(vaults)
      .where(and(eq(vaults.userId, parsed.userId), eq(vaults.slug, parsed.vaultSlug)))
      .limit(1);

    if (!vault) return;

    // Delete the document record from DB (don't touch filesystem -- it's already gone)
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.vaultId, vault.id), eq(documents.path, parsed.docPath)))
      .limit(1);

    if (doc) {
      await db.delete(documents).where(eq(documents.id, doc.id));
      logger.debug({ path: parsed.docPath, vaultId: vault.id }, 'Removed deleted file from DB');
    }
  } catch (err) {
    logger.error({ err, path: absPath }, 'Error syncing file deletion to DB');
  }
}

/**
 * Debounced handler for file events.
 */
function debouncedHandle(absPath: string, handler: (p: string) => Promise<void>): void {
  const existing = debounceMap.get(absPath);
  if (existing) {
    clearTimeout(existing);
  }

  debounceMap.set(
    absPath,
    setTimeout(() => {
      debounceMap.delete(absPath);
      handler(absPath).catch((err) => {
        logger.error({ err, path: absPath }, 'Debounced handler error');
      });
    }, DEBOUNCE_MS),
  );
}

/**
 * Run a full reconciliation: scan all files on disk and compare with DB records.
 * - Add missing records
 * - Update stale records
 * - Remove orphaned records (files in DB but not on disk)
 */
export async function reconcile(): Promise<void> {
  const dataDir = path.resolve(config.DATA_DIR);
  logger.info('Starting filesystem reconciliation');

  try {
    // Ensure data dir exists
    await fs.mkdir(dataDir, { recursive: true });

    // Get all user directories
    let userDirs: string[];
    try {
      userDirs = await fs.readdir(dataDir);
    } catch {
      logger.info('Data directory empty or not accessible, skipping reconciliation');
      return;
    }

    let syncedCount = 0;
    let removedCount = 0;

    for (const userDir of userDirs) {
      const userPath = path.join(dataDir, userDir);
      const userStat = await fs.stat(userPath).catch(() => null);
      if (!userStat?.isDirectory()) continue;

      // Check if this user exists in DB
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userDir))
        .limit(1);

      if (!user) continue;

      // Get vault directories for this user
      let vaultDirs: string[];
      try {
        vaultDirs = await fs.readdir(userPath);
      } catch {
        continue;
      }

      for (const vaultDir of vaultDirs) {
        const vaultPath = path.join(userPath, vaultDir);
        const vaultStat = await fs.stat(vaultPath).catch(() => null);
        if (!vaultStat?.isDirectory()) continue;

        // Look up vault in DB
        const [vault] = await db
          .select({ id: vaults.id })
          .from(vaults)
          .where(and(eq(vaults.userId, userDir), eq(vaults.slug, vaultDir)))
          .limit(1);

        if (!vault) continue;

        // Collect all .md files on disk
        const diskFiles = new Set<string>();
        await walkDir(vaultPath, '', diskFiles);

        // Get all document records for this vault
        const dbDocs = await db
          .select({ id: documents.id, path: documents.path, contentHash: documents.contentHash })
          .from(documents)
          .where(eq(documents.vaultId, vault.id));

        const dbDocMap = new Map(dbDocs.map((d) => [d.path, d]));

        // Sync files from disk to DB
        for (const docPath of diskFiles) {
          try {
            const absFilePath = path.join(vaultPath, ...docPath.split('/'));
            const content = await fs.readFile(absFilePath, 'utf-8');

            await documentService.put(userDir, vault.id, docPath, content, 'webdav');
            syncedCount++;
          } catch (err) {
            logger.error({ err, docPath, vaultId: vault.id }, 'Error syncing file during reconciliation');
          }
        }

        // Remove orphaned DB records (files in DB but not on disk)
        for (const [docPath, doc] of dbDocMap) {
          if (!diskFiles.has(docPath)) {
            try {
              await db.delete(documents).where(eq(documents.id, doc.id));
              removedCount++;
              logger.debug({ docPath, vaultId: vault.id }, 'Removed orphaned document from DB');
            } catch (err) {
              logger.error({ err, docPath }, 'Error removing orphaned document');
            }
          }
        }
      }
    }

    logger.info({ syncedCount, removedCount }, 'Filesystem reconciliation complete');
  } catch (err) {
    logger.error({ err }, 'Reconciliation failed');
  }
}

/**
 * Recursively walk a vault directory and collect all .md file paths.
 * Excludes .obsidian/ directories and hidden files.
 */
async function walkDir(
  baseDir: string,
  prefix: string,
  result: Set<string>,
): Promise<void> {
  const fullDir = prefix ? path.join(baseDir, ...prefix.split('/')) : baseDir;

  let entries;
  try {
    entries = await fs.readdir(fullDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    // Skip hidden entries and .obsidian
    if (entry.name.startsWith('.')) continue;

    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await walkDir(baseDir, relativePath, result);
    } else if (entry.name.endsWith('.md')) {
      result.add(relativePath);
    }
  }
}

/**
 * Start the filesystem watcher.
 */
export function start(): void {
  if (watcher) {
    logger.warn('Sync service already started');
    return;
  }

  const dataDir = path.resolve(config.DATA_DIR);
  logger.info({ dataDir }, 'Starting filesystem watcher');

  watcher = watch(dataDir, {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    depth: 20,
    // Ignore dotfiles/dirs (e.g. .obsidian), temp files
    ignored: [
      /(^|[/\\])\../, // dotfiles
      /\.tmp-/,        // atomic write temp files
    ],
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on('add', (filePath: string) => {
    debouncedHandle(filePath, handleFileChange);
  });

  watcher.on('change', (filePath: string) => {
    debouncedHandle(filePath, handleFileChange);
  });

  watcher.on('unlink', (filePath: string) => {
    debouncedHandle(filePath, handleFileDelete);
  });

  watcher.on('error', (err: unknown) => {
    logger.error({ err }, 'Filesystem watcher error');
  });

  // Schedule periodic reconciliation
  reconcileTimer = setInterval(() => {
    reconcile().catch((err) => {
      logger.error({ err }, 'Periodic reconciliation failed');
    });
  }, RECONCILE_INTERVAL_MS);

  logger.info('Filesystem watcher started');
}

/**
 * Stop the filesystem watcher and cleanup.
 */
export async function stop(): Promise<void> {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }

  // Clear all pending debounce timers
  for (const timer of debounceMap.values()) {
    clearTimeout(timer);
  }
  debounceMap.clear();

  if (watcher) {
    await watcher.close();
    watcher = null;
    logger.info('Filesystem watcher stopped');
  }
}
