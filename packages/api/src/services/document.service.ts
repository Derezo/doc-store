import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { eq, and, like, asc, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { documents, documentVersions } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import * as filesystemService from './filesystem.service.js';
import * as vaultService from './vault.service.js';
import { markRecentlyWritten } from './sync.service.js';
import {
  extractFrontmatter,
  extractTitle,
  extractTags,
  stripMarkdown,
} from '../utils/markdown.js';
import type {
  Document,
  DocumentVersion,
  DocumentListItem,
  TreeNode,
  FileOperationResponse,
} from '@doc-store/shared';

/**
 * Convert a DB document row to a public Document object.
 */
function toPublicDocument(row: typeof documents.$inferSelect): Document {
  return {
    id: row.id,
    vaultId: row.vaultId,
    path: row.path,
    title: row.title,
    contentHash: row.contentHash,
    sizeBytes: row.sizeBytes,
    frontmatter: row.frontmatter as Record<string, any> | null,
    tags: (row.tags as string[]) ?? [],
    fileCreatedAt: row.fileCreatedAt?.toISOString() ?? null,
    fileModifiedAt: row.fileModifiedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Convert a DB document version row to a public DocumentVersion object.
 */
function toPublicVersion(row: typeof documentVersions.$inferSelect): DocumentVersion {
  return {
    id: row.id,
    documentId: row.documentId,
    versionNum: row.versionNum,
    contentHash: row.contentHash,
    sizeBytes: row.sizeBytes,
    changeSource: row.changeSource as 'web' | 'api' | 'webdav',
    changedBy: row.changedBy,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Compute SHA-256 hash of content.
 */
export function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Get a document by path, returning both metadata and content.
 */
export async function get(
  userId: string,
  vaultId: string,
  docPath: string,
): Promise<{ document: Document; content: string }> {
  // Verify vault ownership
  const vault = await vaultService.getRow(userId, vaultId);
  const vaultPath = filesystemService.getVaultPath(userId, vault.slug);

  // Find document in DB
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.vaultId, vaultId), eq(documents.path, docPath)))
    .limit(1);

  if (!doc) {
    throw new NotFoundError(`Document not found: ${docPath}`);
  }

  // Read content from filesystem
  const content = await filesystemService.readFile(vaultPath, docPath);

  return {
    document: toPublicDocument(doc),
    content,
  };
}

/**
 * Create or update a document. This is the core upsert operation.
 *
 * 1. Compute SHA-256 hash
 * 2. Check if document exists
 *    - If exists and hash matches: skip (no change)
 *    - If exists and hash differs: update
 *    - If doesn't exist: create
 * 3. Write file to disk (atomic)
 * 4. Extract frontmatter, title, tags
 * 5. Strip markdown for search content
 * 6. Upsert document record
 * 7. Create document_version record
 */
export async function put(
  userId: string,
  vaultId: string,
  docPath: string,
  content: string,
  source: 'web' | 'api' | 'webdav',
): Promise<Document> {
  // Verify vault ownership
  const vault = await vaultService.getRow(userId, vaultId);
  const vaultPath = filesystemService.getVaultPath(userId, vault.slug);

  // 1. Compute hash
  const contentHash = computeHash(content);
  const sizeBytes = Buffer.byteLength(content, 'utf-8');

  // 2. Check if document exists
  const [existingDoc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.vaultId, vaultId), eq(documents.path, docPath)))
    .limit(1);

  if (existingDoc && existingDoc.contentHash === contentHash) {
    // No change — return existing document
    return toPublicDocument(existingDoc);
  }

  // 3. Write file to disk (atomic)
  await filesystemService.writeFile(vaultPath, docPath, content);

  // Mark file as recently written so the sync watcher doesn't double-process
  const absFilePath = path.resolve(vaultPath, docPath);
  markRecentlyWritten(absFilePath);

  // 4. Extract metadata from content
  const { data: frontmatterData, content: markdownContent } =
    extractFrontmatter(content);
  const title = extractTitle(frontmatterData, markdownContent);
  const tags = extractTags(frontmatterData, markdownContent);

  // 5. Strip markdown for search
  const strippedContent = stripMarkdown(markdownContent);

  const now = new Date();
  const frontmatterJson =
    Object.keys(frontmatterData).length > 0 ? frontmatterData : null;

  if (existingDoc) {
    // UPDATE existing document
    const tagsText = (tags ?? []).join(' ');
    const [updated] = await db
      .update(documents)
      .set({
        contentHash,
        sizeBytes,
        title,
        frontmatter: frontmatterJson,
        tags,
        strippedContent,
        contentTsv: sql`to_tsvector('english', ${title ?? ''} || ' ' || ${tagsText} || ' ' || ${strippedContent})`,
        fileModifiedAt: now,
        updatedAt: now,
      })
      .where(eq(documents.id, existingDoc.id))
      .returning();

    // Get the latest version number
    const [latestVersion] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, existingDoc.id))
      .orderBy(desc(documentVersions.versionNum))
      .limit(1);

    const nextVersionNum = (latestVersion?.versionNum ?? 0) + 1;

    // Create version record
    await db.insert(documentVersions).values({
      documentId: existingDoc.id,
      versionNum: nextVersionNum,
      contentHash,
      sizeBytes,
      changeSource: source,
      changedBy: userId,
    });

    return toPublicDocument(updated);
  } else {
    // CREATE new document
    const newTagsText = (tags ?? []).join(' ');
    const [newDoc] = await db
      .insert(documents)
      .values({
        vaultId,
        path: docPath,
        title,
        contentHash,
        sizeBytes,
        frontmatter: frontmatterJson,
        tags,
        strippedContent,
        contentTsv: sql`to_tsvector('english', ${title ?? ''} || ' ' || ${newTagsText} || ' ' || ${strippedContent})`,
        fileCreatedAt: now,
        fileModifiedAt: now,
      })
      .returning();

    // Create initial version record
    await db.insert(documentVersions).values({
      documentId: newDoc.id,
      versionNum: 1,
      contentHash,
      sizeBytes,
      changeSource: source,
      changedBy: userId,
    });

    return toPublicDocument(newDoc);
  }
}

/**
 * Delete a document or directory from both filesystem and database.
 */
export async function remove(
  userId: string,
  vaultId: string,
  docPath: string,
): Promise<void> {
  // Verify vault ownership
  const vault = await vaultService.getRow(userId, vaultId);
  const vaultPath = filesystemService.getVaultPath(userId, vault.slug);

  // Try to find document in DB (file case)
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.vaultId, vaultId), eq(documents.path, docPath)))
    .limit(1);

  if (doc) {
    // File deletion
    await filesystemService.deleteFile(vaultPath, docPath);

    // Mark file as recently written so the sync watcher doesn't double-process
    const absDeletePath = path.resolve(vaultPath, docPath);
    markRecentlyWritten(absDeletePath);

    // Delete from DB (cascade deletes versions)
    await db.delete(documents).where(eq(documents.id, doc.id));
  } else {
    // Check if it's a directory
    const pathType = await filesystemService.pathExists(vaultPath, docPath);
    if (pathType === 'directory') {
      // Directory deletion
      // Delete all child documents from DB
      const escapedPath = docPath.replace(/%/g, '\\%').replace(/_/g, '\\_');
      await db
        .delete(documents)
        .where(
          and(
            eq(documents.vaultId, vaultId),
            like(documents.path, `${escapedPath}/%`),
          ),
        );

      // Delete directory from filesystem
      await filesystemService.deleteDirectory(vaultPath, docPath);

      // Mark as recently written
      const absDeletePath = path.resolve(vaultPath, docPath);
      markRecentlyWritten(absDeletePath);
    } else {
      throw new NotFoundError(`Document or directory not found: ${docPath}`);
    }
  }
}

/**
 * List documents in a vault, optionally filtered to a directory prefix.
 */
export async function list(
  userId: string,
  vaultId: string,
  dirPath?: string,
): Promise<DocumentListItem[]> {
  // Verify vault ownership
  await vaultService.getRow(userId, vaultId);

  // Escape SQL LIKE wildcards in directory path to prevent wildcard injection
  const escapedDirPath = dirPath
    ? dirPath.replace(/%/g, '\\%').replace(/_/g, '\\_')
    : undefined;

  let query = db
    .select({
      path: documents.path,
      title: documents.title,
      tags: documents.tags,
      sizeBytes: documents.sizeBytes,
      fileModifiedAt: documents.fileModifiedAt,
    })
    .from(documents)
    .where(
      escapedDirPath
        ? and(
            eq(documents.vaultId, vaultId),
            like(documents.path, `${escapedDirPath}/%`),
          )
        : eq(documents.vaultId, vaultId),
    )
    .orderBy(asc(documents.path));

  const rows = await query;

  return rows.map((row) => ({
    path: row.path,
    title: row.title,
    tags: (row.tags as string[]) ?? [],
    sizeBytes: row.sizeBytes,
    fileModifiedAt: row.fileModifiedAt.toISOString(),
  }));
}

/**
 * Build a directory tree from all document paths in a vault.
 */
export async function tree(
  userId: string,
  vaultId: string,
): Promise<TreeNode[]> {
  // Verify vault ownership
  await vaultService.getRow(userId, vaultId);

  const rows = await db
    .select({ path: documents.path })
    .from(documents)
    .where(eq(documents.vaultId, vaultId))
    .orderBy(asc(documents.path));

  // Build tree from flat list of paths
  const root: TreeNode[] = [];

  for (const row of rows) {
    const parts = row.path.split('/');
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      const existing = currentLevel.find(
        (node) => node.name === part && node.type === (isFile ? 'file' : 'directory'),
      );

      if (existing) {
        if (!isFile && existing.children) {
          currentLevel = existing.children;
        }
      } else {
        const newNode: TreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
        };

        if (!isFile) {
          newNode.children = [];
        }

        currentLevel.push(newNode);

        if (!isFile && newNode.children) {
          currentLevel = newNode.children;
        }
      }
    }
  }

  return root;
}

/**
 * Get version history for a document.
 */
export async function getVersions(
  userId: string,
  vaultId: string,
  docPath: string,
): Promise<DocumentVersion[]> {
  // Verify vault ownership
  await vaultService.getRow(userId, vaultId);

  // Find document
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.vaultId, vaultId), eq(documents.path, docPath)))
    .limit(1);

  if (!doc) {
    throw new NotFoundError(`Document not found: ${docPath}`);
  }

  const rows = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, doc.id))
    .orderBy(desc(documentVersions.versionNum));

  return rows.map(toPublicVersion);
}

/**
 * Move/rename a file or directory.
 */
export async function move(
  userId: string,
  vaultId: string,
  sourcePath: string,
  destPath: string,
  overwrite: boolean = false,
): Promise<FileOperationResponse> {
  // Verify vault ownership
  const vault = await vaultService.getRow(userId, vaultId);
  const vaultPath = filesystemService.getVaultPath(userId, vault.slug);

  // Check if source exists and determine type
  const sourceType = await filesystemService.pathExists(vaultPath, sourcePath);
  if (!sourceType) {
    throw new NotFoundError(`Source not found: ${sourcePath}`);
  }

  // Check if destination exists
  const destExists = await filesystemService.pathExists(vaultPath, destPath);
  if (destExists && !overwrite) {
    throw new ConflictError(`Destination already exists: ${destPath}`);
  }

  if (sourceType === 'file') {
    // Check that document exists in DB
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.vaultId, vaultId), eq(documents.path, sourcePath)))
      .limit(1);

    if (!doc) {
      throw new NotFoundError(`Document not found in database: ${sourcePath}`);
    }

    // Move file on disk
    await filesystemService.moveFile(vaultPath, sourcePath, destPath);

    // Mark both paths as recently written
    const absSourcePath = path.resolve(vaultPath, sourcePath);
    const absDestPath = path.resolve(vaultPath, destPath);
    markRecentlyWritten(absSourcePath);
    markRecentlyWritten(absDestPath);

    // Update document path in DB
    await db
      .update(documents)
      .set({ path: destPath, updatedAt: new Date() })
      .where(eq(documents.id, doc.id));
  } else {
    // Directory move
    await filesystemService.moveDirectory(vaultPath, sourcePath, destPath);

    // Mark destination as recently written
    const absDestPath = path.resolve(vaultPath, destPath);
    markRecentlyWritten(absDestPath);

    // Update all document paths in DB
    const sourcePrefix = `${sourcePath}/`;
    const destPrefix = `${destPath}/`;

    await db
      .update(documents)
      .set({
        path: sql`${destPrefix} || substr(${documents.path}, length(${sourcePrefix}) + 1)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(documents.vaultId, vaultId),
          like(documents.path, `${sourcePath.replace(/%/g, '\\%').replace(/_/g, '\\_')}/%`),
        ),
      );
  }

  return {
    message: 'Move operation completed successfully',
    source: sourcePath,
    destination: destPath,
  };
}

/**
 * Copy a file or directory.
 */
export async function copy(
  userId: string,
  vaultId: string,
  sourcePath: string,
  destPath: string,
  overwrite: boolean = false,
): Promise<FileOperationResponse> {
  // Verify vault ownership
  const vault = await vaultService.getRow(userId, vaultId);
  const vaultPath = filesystemService.getVaultPath(userId, vault.slug);

  // Check if source exists and determine type
  const sourceType = await filesystemService.pathExists(vaultPath, sourcePath);
  if (!sourceType) {
    throw new NotFoundError(`Source not found: ${sourcePath}`);
  }

  // Check if destination exists
  const destExists = await filesystemService.pathExists(vaultPath, destPath);
  if (destExists && !overwrite) {
    throw new ConflictError(`Destination already exists: ${destPath}`);
  }

  if (sourceType === 'file') {
    // Read source content and create at destination
    const { content } = await get(userId, vaultId, sourcePath);
    await put(userId, vaultId, destPath, content, 'api');
  } else {
    // Directory copy
    await filesystemService.copyDirectory(vaultPath, sourcePath, destPath);

    // Walk destination and create DB entries for all .md files
    const absDestPath = path.resolve(vaultPath, destPath);

    async function walkAndSync(dir: string, prefix: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const absEntryPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walkAndSync(absEntryPath, entryPath);
        } else if (entry.name.endsWith('.md')) {
          const content = await fs.readFile(absEntryPath, 'utf-8');
          await put(userId, vaultId, entryPath, content, 'api');
        }
      }
    }

    await walkAndSync(absDestPath, destPath);
  }

  return {
    message: 'Copy operation completed successfully',
    source: sourcePath,
    destination: destPath,
  };
}

/**
 * Create an empty directory.
 */
export async function createDirectory(
  userId: string,
  vaultId: string,
  dirPath: string,
): Promise<{ message: string; path: string }> {
  // Verify vault ownership
  const vault = await vaultService.getRow(userId, vaultId);
  const vaultPath = filesystemService.getVaultPath(userId, vault.slug);

  // Create directory
  await filesystemService.createDirectory(vaultPath, dirPath);

  return {
    message: 'Directory created successfully',
    path: dirPath,
  };
}
