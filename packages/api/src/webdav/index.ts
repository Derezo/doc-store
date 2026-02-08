import { Router, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { authenticate, type WebDavAuthResult } from './authenticator.js';
import * as documentService from '../services/document.service.js';
import { markRecentlyWritten } from '../services/sync.service.js';
import { logger as rootLogger } from '../utils/logger.js';

const logger = rootLogger.child({ module: 'webdav' });

// ── CORS origins for Obsidian ──────────────────────────────────────────

const OBSIDIAN_ORIGINS = [
  'app://obsidian.md',
  'capacitor://localhost',
  'http://localhost',
];

const WEBDAV_METHODS = [
  'OPTIONS', 'GET', 'HEAD', 'PUT', 'DELETE',
  'MKCOL', 'MOVE', 'COPY', 'PROPFIND',
  'LOCK', 'UNLOCK',
].join(', ');

const WEBDAV_HEADERS = [
  'Authorization', 'Content-Type', 'Content-Length',
  'Depth', 'Destination', 'If', 'Lock-Token',
  'Overwrite', 'Timeout', 'X-Requested-With',
].join(', ');

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Resolve a request path relative to the vault root.
 * The URL pattern is /webdav/:vaultSlug/... where everything after the slug
 * is the file/directory path within the vault.
 *
 * Returns the relative path with forward slashes, no leading slash.
 * Returns empty string for vault root.
 */
function getRelativePath(req: Request): string {
  // In Express 5, wildcard /*splat captures as req.params.splat (possibly an array)
  const raw = (req.params as any).splat;
  let pathStr: string;
  if (Array.isArray(raw)) {
    pathStr = raw.join('/');
  } else {
    pathStr = String(raw ?? '');
  }
  // Normalize: strip leading/trailing slashes, collapse double slashes
  return pathStr
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/+/g, '/');
}

/**
 * Validate a relative path for safety (no traversal, no null bytes).
 */
function validateRelPath(relPath: string): boolean {
  if (relPath.includes('\0')) return false;
  if (relPath.includes('\\')) return false;

  const segments = relPath.split('/');
  for (const seg of segments) {
    if (seg === '..') return false;
  }
  return true;
}

/**
 * Resolve an absolute path within the vault, with safety check.
 */
function resolveInVault(vaultPath: string, relPath: string): string | null {
  if (!validateRelPath(relPath)) return null;

  const resolved = path.resolve(vaultPath, relPath);
  const vaultRoot = path.resolve(vaultPath);

  if (resolved !== vaultRoot && !resolved.startsWith(vaultRoot + path.sep)) {
    return null;
  }
  return resolved;
}

/**
 * Format a Date as an HTTP date string for WebDAV responses.
 */
function httpDate(date: Date): string {
  return date.toUTCString();
}

/**
 * Escape XML special characters.
 */
function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build the base URL for href generation.
 * Takes the vault slug from auth result and the request to build the prefix.
 */
function hrefPrefix(req: Request, vaultSlug: string): string {
  return `/webdav/${encodeURIComponent(vaultSlug)}`;
}

/**
 * Encode each segment of a path for use in a URL.
 */
function encodePath(relPath: string): string {
  if (!relPath) return '';
  return relPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/**
 * Get the MIME type for a file based on extension.
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  };
  return types[ext] || 'application/octet-stream';
}

// ── PROPFIND XML builders ──────────────────────────────────────────────

interface PropfindEntry {
  href: string;
  isCollection: boolean;
  contentLength: number;
  lastModified: Date;
  contentType: string;
  etag?: string;
}

function buildMultistatus(entries: PropfindEntry[]): string {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<D:multistatus xmlns:D="DAV:">\n';

  for (const entry of entries) {
    xml += '  <D:response>\n';
    xml += `    <D:href>${xmlEscape(entry.href)}</D:href>\n`;
    xml += '    <D:propstat>\n';
    xml += '      <D:prop>\n';

    if (entry.isCollection) {
      xml += '        <D:resourcetype><D:collection/></D:resourcetype>\n';
    } else {
      xml += '        <D:resourcetype/>\n';
    }

    xml += `        <D:getcontentlength>${entry.contentLength}</D:getcontentlength>\n`;
    xml += `        <D:getlastmodified>${httpDate(entry.lastModified)}</D:getlastmodified>\n`;
    xml += `        <D:getcontenttype>${xmlEscape(entry.contentType)}</D:getcontenttype>\n`;

    if (entry.etag) {
      xml += `        <D:getetag>"${xmlEscape(entry.etag)}"</D:getetag>\n`;
    }

    xml += '      </D:prop>\n';
    xml += '      <D:status>HTTP/1.1 200 OK</D:status>\n';
    xml += '    </D:propstat>\n';
    xml += '  </D:response>\n';
  }

  xml += '</D:multistatus>\n';
  return xml;
}

// ── Stat helper ────────────────────────────────────────────────────────

async function safeStat(absPath: string): Promise<import('node:fs').Stats | null> {
  try {
    return await fs.stat(absPath);
  } catch {
    return null;
  }
}

// ── Collect directory entries for PROPFIND ─────────────────────────────

async function collectEntries(
  vaultPath: string,
  absPath: string,
  relPath: string,
  prefix: string,
  depth: number,
): Promise<PropfindEntry[]> {
  const entries: PropfindEntry[] = [];
  const stat = await safeStat(absPath);

  if (!stat) return entries;

  // Add the resource itself
  const href = relPath
    ? `${prefix}/${encodePath(relPath)}${stat.isDirectory() ? '/' : ''}`
    : `${prefix}/`;

  entries.push({
    href,
    isCollection: stat.isDirectory(),
    contentLength: stat.isDirectory() ? 0 : stat.size,
    lastModified: stat.mtime,
    contentType: stat.isDirectory() ? 'httpd/unix-directory' : getMimeType(absPath),
    etag: stat.isDirectory() ? undefined : `${stat.size}-${stat.mtimeMs.toString(36)}`,
  });

  // If it's a directory and depth > 0, list children
  if (stat.isDirectory() && depth > 0) {
    let children;
    try {
      children = await fs.readdir(absPath, { withFileTypes: true });
    } catch {
      return entries;
    }

    for (const child of children) {
      // Skip temp files but allow .obsidian (needed for Obsidian settings sync)
      if (child.name.startsWith('.') && child.name !== '.obsidian') continue;

      const childRelPath = relPath ? `${relPath}/${child.name}` : child.name;
      const childAbsPath = path.join(absPath, child.name);

      if (depth === 1) {
        // Only one level deep -- don't recurse
        const childStat = await safeStat(childAbsPath);
        if (!childStat) continue;

        const childHref = `${prefix}/${encodePath(childRelPath)}${childStat.isDirectory() ? '/' : ''}`;
        entries.push({
          href: childHref,
          isCollection: childStat.isDirectory(),
          contentLength: childStat.isDirectory() ? 0 : childStat.size,
          lastModified: childStat.mtime,
          contentType: childStat.isDirectory() ? 'httpd/unix-directory' : getMimeType(childAbsPath),
          etag: childStat.isDirectory() ? undefined : `${childStat.size}-${childStat.mtimeMs.toString(36)}`,
        });
      } else {
        // Infinite depth -- recurse
        const childEntries = await collectEntries(
          vaultPath, childAbsPath, childRelPath, prefix, depth - 1,
        );
        entries.push(...childEntries);
      }
    }
  }

  return entries;
}

// ── DB sync after write operations ─────────────────────────────────────

/**
 * Sync a file write to the DB asynchronously.
 * This is called after PUT/MOVE operations to keep Postgres in sync.
 */
async function syncFileToDb(
  auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
): Promise<void> {
  // Only sync .md files to the DB
  if (!relPath.endsWith('.md')) return;

  // Skip .obsidian directory contents
  if (relPath.startsWith('.obsidian/') || relPath.includes('/.obsidian/')) return;

  try {
    const content = await fs.readFile(absPath, 'utf-8');
    await documentService.put(
      auth.userId,
      auth.vaultId,
      relPath,
      content,
      'webdav',
    );
    logger.debug({ path: relPath }, 'Synced WebDAV write to DB');
  } catch (err) {
    logger.error({ err, path: relPath }, 'Failed to sync WebDAV write to DB');
  }
}

/**
 * Sync a file deletion to the DB asynchronously.
 */
async function syncDeleteToDb(
  auth: WebDavAuthResult,
  relPath: string,
): Promise<void> {
  if (!relPath.endsWith('.md')) return;
  if (relPath.startsWith('.obsidian/') || relPath.includes('/.obsidian/')) return;

  try {
    await documentService.remove(auth.userId, auth.vaultId, relPath);
    logger.debug({ path: relPath }, 'Synced WebDAV delete to DB');
  } catch (err: any) {
    // NotFoundError is fine -- the doc might not have been in the DB
    if (err.statusCode !== 404) {
      logger.error({ err, path: relPath }, 'Failed to sync WebDAV delete to DB');
    }
  }
}

/**
 * Recursively sync all .md files in a directory to the DB.
 * Used after directory MOVE/COPY operations.
 */
async function syncDirectoryToDb(
  auth: WebDavAuthResult,
  dirAbsPath: string,
  dirRelPath: string,
): Promise<void> {
  try {
    const entries = await fs.readdir(dirAbsPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryRelPath = dirRelPath ? `${dirRelPath}/${entry.name}` : entry.name;
      const entryAbsPath = path.join(dirAbsPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.obsidian') continue;
        await syncDirectoryToDb(auth, entryAbsPath, entryRelPath);
      } else if (entry.name.endsWith('.md')) {
        syncFileToDb(auth, entryRelPath, entryAbsPath).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err, path: dirRelPath }, 'Failed to sync directory to DB after move/copy');
  }
}

// ── Router ─────────────────────────────────────────────────────────────

const webdavRouter = Router();

/**
 * CORS middleware for Obsidian clients.
 * Applied to all WebDAV routes.
 */
webdavRouter.use((req: Request, res: Response, next) => {
  const origin = req.headers.origin;

  if (origin && OBSIDIAN_ORIGINS.some((o) => origin.startsWith(o))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  // Non-Obsidian origins do not get CORS headers (browser will block cross-origin requests)

  res.setHeader('Access-Control-Allow-Methods', WEBDAV_METHODS);
  res.setHeader('Access-Control-Allow-Headers', WEBDAV_HEADERS);
  res.setHeader('Access-Control-Expose-Headers', 'DAV, Content-Type, Allow, ETag');
  res.setHeader('Access-Control-Max-Age', '86400');

  // DAV compliance header
  res.setHeader('DAV', '1, 2');

  next();
});

/**
 * All WebDAV methods go through /:vaultSlug/* wildcard route.
 * We use router.all() and dispatch based on req.method.
 */
webdavRouter.all('/:vaultSlug', handleWebDav);
webdavRouter.all('/:vaultSlug/*splat', handleWebDav);

async function handleWebDav(req: Request, res: Response): Promise<void> {
  const method = req.method.toUpperCase();
  const rawSlug = req.params.vaultSlug;
  const vaultSlug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  // OPTIONS doesn't require auth (for CORS preflight)
  if (method === 'OPTIONS') {
    res.setHeader('Allow', WEBDAV_METHODS);
    res.setHeader('DAV', '1, 2');
    res.status(200).end();
    return;
  }

  // Authenticate
  let auth: WebDavAuthResult;
  try {
    const rawAuth = req.headers.authorization;
    const authHeader = (Array.isArray(rawAuth) ? rawAuth[0] : rawAuth) as string | undefined;
    auth = await authenticate(authHeader, vaultSlug);
  } catch (err: any) {
    res.setHeader('WWW-Authenticate', 'Basic realm="doc-store WebDAV"');
    res.status(err.statusCode || 401).json({ error: err.message });
    return;
  }

  const relPath = getRelativePath(req);
  const absPath = resolveInVault(auth.vaultPath, relPath || '.');

  if (!absPath) {
    res.status(403).send('Forbidden: path traversal detected');
    return;
  }

  try {
    switch (method) {
      case 'PROPFIND':
        await handlePropfind(req, res, auth, relPath, absPath);
        break;
      case 'GET':
      case 'HEAD':
        await handleGet(req, res, auth, relPath, absPath, method === 'HEAD');
        break;
      case 'PUT':
        await handlePut(req, res, auth, relPath, absPath);
        break;
      case 'DELETE':
        await handleDelete(req, res, auth, relPath, absPath);
        break;
      case 'MKCOL':
        await handleMkcol(req, res, auth, relPath, absPath);
        break;
      case 'MOVE':
        await handleMove(req, res, auth, relPath, absPath);
        break;
      case 'COPY':
        await handleCopy(req, res, auth, relPath, absPath);
        break;
      case 'LOCK':
        await handleLock(req, res, auth, relPath, absPath);
        break;
      case 'UNLOCK':
        await handleUnlock(req, res, auth, relPath, absPath);
        break;
      default:
        res.status(405).send('Method Not Allowed');
    }
  } catch (err: any) {
    logger.error({ err, method, path: relPath }, 'WebDAV handler error');
    res.status(500).send('Internal Server Error');
  }
}

// ── PROPFIND ───────────────────────────────────────────────────────────

async function handlePropfind(
  req: Request,
  res: Response,
  auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
): Promise<void> {
  const stat = await safeStat(absPath);
  if (!stat) {
    res.status(404).send('Not Found');
    return;
  }

  // Parse Depth header
  const depthHeader = req.headers['depth'] as string | undefined;
  let depth: number;
  if (depthHeader === '0') {
    depth = 0;
  } else if (depthHeader === '1' || depthHeader === undefined) {
    depth = 1;
  } else {
    // 'infinity' or any other value
    depth = Infinity;
  }

  const prefix = hrefPrefix(req, auth.vaultSlug);
  const entries = await collectEntries(auth.vaultPath, absPath, relPath, prefix, depth);

  const xml = buildMultistatus(entries);

  res.status(207);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
}

// ── GET / HEAD ─────────────────────────────────────────────────────────

async function handleGet(
  _req: Request,
  res: Response,
  _auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
  headOnly: boolean,
): Promise<void> {
  const stat = await safeStat(absPath);
  if (!stat) {
    res.status(404).send('Not Found');
    return;
  }

  if (stat.isDirectory()) {
    // Directories can't be GET'd in WebDAV
    res.status(405).send('Cannot GET a directory');
    return;
  }

  const etag = `"${stat.size}-${stat.mtimeMs.toString(36)}"`;
  res.setHeader('Content-Type', getMimeType(absPath));
  res.setHeader('Content-Length', stat.size.toString());
  res.setHeader('Last-Modified', httpDate(stat.mtime));
  res.setHeader('ETag', etag);

  if (headOnly) {
    res.status(200).end();
    return;
  }

  const content = await fs.readFile(absPath);
  res.status(200).send(content);
}

// ── PUT ────────────────────────────────────────────────────────────────

async function handlePut(
  req: Request,
  res: Response,
  auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
): Promise<void> {
  if (!relPath) {
    res.status(405).send('Cannot PUT to vault root');
    return;
  }

  // Check if parent directory exists
  const parentDir = path.dirname(absPath);
  const parentStat = await safeStat(parentDir);
  if (!parentStat || !parentStat.isDirectory()) {
    // Auto-create parent directories (Obsidian expects this)
    await fs.mkdir(parentDir, { recursive: true });
  }

  const existed = (await safeStat(absPath)) !== null;

  // Collect request body
  const chunks: Buffer[] = [];
  for await (const chunk of req as any) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks);

  // Atomic write: temp file + rename
  const tempFile = path.join(
    parentDir,
    `.tmp-${crypto.randomBytes(8).toString('hex')}`,
  );

  try {
    await fs.writeFile(tempFile, body);
    await fs.rename(tempFile, absPath);
  } catch (err) {
    try { await fs.unlink(tempFile); } catch { /* ignore */ }
    throw err;
  }

  // Mark as recently written so the file watcher doesn't double-process
  markRecentlyWritten(absPath);

  // Async DB sync (fire and forget)
  syncFileToDb(auth, relPath, absPath).catch(() => {});

  res.status(existed ? 204 : 201).end();
}

// ── DELETE ──────────────────────────────────────────────────────────────

async function handleDelete(
  _req: Request,
  res: Response,
  auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
): Promise<void> {
  const stat = await safeStat(absPath);
  if (!stat) {
    res.status(404).send('Not Found');
    return;
  }

  if (stat.isDirectory()) {
    // Recursively delete directory
    // First, sync all .md files in the directory to DB as deletions
    const mdFiles = await collectMdFiles(absPath, relPath);
    await fs.rm(absPath, { recursive: true, force: true });

    markRecentlyWritten(absPath);

    // Sync all deleted .md files to DB
    for (const mdRelPath of mdFiles) {
      syncDeleteToDb(auth, mdRelPath).catch(() => {});
    }
  } else {
    await fs.unlink(absPath);
    markRecentlyWritten(absPath);
    syncDeleteToDb(auth, relPath).catch(() => {});

    // Clean up empty parent directories (up to vault root)
    let dir = path.dirname(absPath);
    const vaultRoot = path.resolve(auth.vaultPath);
    while (dir !== vaultRoot && dir.startsWith(vaultRoot)) {
      try {
        await fs.rmdir(dir);
        dir = path.dirname(dir);
      } catch {
        break; // directory not empty
      }
    }
  }

  res.status(204).end();
}

/**
 * Collect all .md file relative paths within a directory (for delete sync).
 */
async function collectMdFiles(absDir: string, relPrefix: string): Promise<string[]> {
  const result: string[] = [];

  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    const childRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const childAbs = path.join(absDir, entry.name);

    if (entry.isDirectory()) {
      const sub = await collectMdFiles(childAbs, childRel);
      result.push(...sub);
    } else if (entry.name.endsWith('.md') && !entry.name.startsWith('.')) {
      result.push(childRel);
    }
  }

  return result;
}

// ── MKCOL ──────────────────────────────────────────────────────────────

async function handleMkcol(
  _req: Request,
  res: Response,
  _auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
): Promise<void> {
  if (!relPath) {
    res.status(405).send('Cannot MKCOL vault root');
    return;
  }

  const existing = await safeStat(absPath);
  if (existing) {
    res.status(405).send('Resource already exists');
    return;
  }

  // Check parent exists
  const parentDir = path.dirname(absPath);
  const parentStat = await safeStat(parentDir);
  if (!parentStat || !parentStat.isDirectory()) {
    res.status(409).send('Parent directory does not exist');
    return;
  }

  await fs.mkdir(absPath);
  res.status(201).end();
}

// ── MOVE ───────────────────────────────────────────────────────────────

async function handleMove(
  req: Request,
  res: Response,
  auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
): Promise<void> {
  const destination = req.headers['destination'] as string | undefined;
  if (!destination) {
    res.status(400).send('Destination header required');
    return;
  }

  // Parse destination to get the relative path
  const destRelPath = parseDestination(destination, auth.vaultSlug);
  if (destRelPath === null) {
    res.status(502).send('Invalid destination');
    return;
  }

  const destAbsPath = resolveInVault(auth.vaultPath, destRelPath || '.');
  if (!destAbsPath) {
    res.status(403).send('Forbidden: destination path traversal');
    return;
  }

  const sourceStat = await safeStat(absPath);
  if (!sourceStat) {
    res.status(404).send('Source not found');
    return;
  }

  const destExists = (await safeStat(destAbsPath)) !== null;
  const overwrite = req.headers['overwrite'] !== 'F';

  if (destExists && !overwrite) {
    res.status(412).send('Destination exists and Overwrite is F');
    return;
  }

  // Ensure destination parent directory exists
  const destParent = path.dirname(destAbsPath);
  await fs.mkdir(destParent, { recursive: true });

  // If destination exists and overwrite is allowed, remove it first
  if (destExists) {
    await fs.rm(destAbsPath, { recursive: true, force: true });
  }

  await fs.rename(absPath, destAbsPath);

  markRecentlyWritten(absPath);
  markRecentlyWritten(destAbsPath);

  // Sync: delete old path, add new path(s)
  syncDeleteToDb(auth, relPath).catch(() => {});
  if (sourceStat.isDirectory()) {
    syncDirectoryToDb(auth, destAbsPath, destRelPath).catch(() => {});
  } else {
    syncFileToDb(auth, destRelPath, destAbsPath).catch(() => {});
  }

  // Clean up empty parent directories of source
  let dir = path.dirname(absPath);
  const vaultRoot = path.resolve(auth.vaultPath);
  while (dir !== vaultRoot && dir.startsWith(vaultRoot)) {
    try {
      await fs.rmdir(dir);
      dir = path.dirname(dir);
    } catch {
      break;
    }
  }

  res.status(destExists ? 204 : 201).end();
}

/**
 * Parse a WebDAV Destination header to extract the relative path within the vault.
 * The Destination header can be a full URL or an absolute path.
 */
function parseDestination(destination: string, vaultSlug: string): string | null {
  let pathname: string;

  try {
    // If it's a full URL, parse it
    if (destination.startsWith('http://') || destination.startsWith('https://')) {
      const url = new URL(destination);
      pathname = decodeURIComponent(url.pathname);
    } else {
      // It's an absolute path
      pathname = decodeURIComponent(destination);
    }
  } catch {
    return null;
  }

  // Expected pattern: /webdav/{vaultSlug}/{...path}
  const prefix = `/webdav/${vaultSlug}/`;
  const prefixAlt = `/webdav/${vaultSlug}`;

  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length).replace(/\/+$/, '');
  } else if (pathname === prefixAlt || pathname === prefixAlt + '/') {
    return '';
  }

  return null;
}

// ── COPY ───────────────────────────────────────────────────────────────

async function handleCopy(
  req: Request,
  res: Response,
  auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
): Promise<void> {
  const destination = req.headers['destination'] as string | undefined;
  if (!destination) {
    res.status(400).send('Destination header required');
    return;
  }

  const destRelPath = parseDestination(destination, auth.vaultSlug);
  if (destRelPath === null) {
    res.status(502).send('Invalid destination');
    return;
  }

  const destAbsPath = resolveInVault(auth.vaultPath, destRelPath || '.');
  if (!destAbsPath) {
    res.status(403).send('Forbidden: destination path traversal');
    return;
  }

  const sourceStat = await safeStat(absPath);
  if (!sourceStat) {
    res.status(404).send('Source not found');
    return;
  }

  const destExists = (await safeStat(destAbsPath)) !== null;
  const overwrite = req.headers['overwrite'] !== 'F';

  if (destExists && !overwrite) {
    res.status(412).send('Destination exists and Overwrite is F');
    return;
  }

  // Ensure destination parent exists
  const destParent = path.dirname(destAbsPath);
  await fs.mkdir(destParent, { recursive: true });

  if (sourceStat.isDirectory()) {
    await copyDir(absPath, destAbsPath);
  } else {
    await fs.copyFile(absPath, destAbsPath);
  }

  markRecentlyWritten(destAbsPath);

  // Sync new file(s) to DB
  if (sourceStat.isDirectory()) {
    syncDirectoryToDb(auth, destAbsPath, destRelPath).catch(() => {});
  } else {
    syncFileToDb(auth, destRelPath, destAbsPath).catch(() => {});
  }

  res.status(destExists ? 204 : 201).end();
}

/**
 * Recursively copy a directory.
 */
async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcChild = path.join(src, entry.name);
    const destChild = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcChild, destChild);
    } else {
      await fs.copyFile(srcChild, destChild);
    }
  }
}

// ── LOCK / UNLOCK (minimal stubs) ─────────────────────────────────────

/**
 * Minimal LOCK implementation.
 * Returns a fake lock token to satisfy WebDAV clients.
 * We don't actually enforce locking since this is a single-user-per-vault system.
 */
async function handleLock(
  _req: Request,
  res: Response,
  _auth: WebDavAuthResult,
  relPath: string,
  absPath: string,
): Promise<void> {
  const stat = await safeStat(absPath);

  // If the resource doesn't exist, create an empty file (lock-null resource)
  if (!stat) {
    const parentDir = path.dirname(absPath);
    await fs.mkdir(parentDir, { recursive: true });
    await fs.writeFile(absPath, '');
  }

  const lockToken = `urn:uuid:${crypto.randomUUID()}`;
  const timeout = 'Second-3600';

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>infinity</D:depth>
      <D:timeout>${timeout}</D:timeout>
      <D:locktoken>
        <D:href>${lockToken}</D:href>
      </D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>
`;

  res.status(200);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Lock-Token', `<${lockToken}>`);
  res.send(xml);
}

/**
 * Minimal UNLOCK implementation.
 * Always succeeds since we don't actually track locks.
 */
async function handleUnlock(
  _req: Request,
  res: Response,
  _auth: WebDavAuthResult,
  _relPath: string,
  _absPath: string,
): Promise<void> {
  res.status(204).end();
}

export default webdavRouter;
