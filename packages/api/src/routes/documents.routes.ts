import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  putDocumentSchema,
  moveDocumentSchema,
  copyDocumentSchema,
  createDirectorySchema,
} from '@doc-store/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireScope, requireVaultAccess } from '../middleware/auth.js';
import { validatePath, validateDirPath } from '../services/filesystem.service.js';
import * as documentService from '../services/document.service.js';
import * as vaultService from '../services/vault.service.js';

const router = Router({ mergeParams: true });

/**
 * Extract the wildcard path parameter from Express 5 params.
 * In Express 5, wildcard `*path` captures as an array or string depending on version.
 * This helper normalizes to a string.
 */
function getWildcardPath(params: Record<string, any>): string {
  const raw = params.path;
  if (Array.isArray(raw)) {
    return raw.join('/');
  }
  return String(raw ?? '');
}

/**
 * Translate user-facing path to internal path by prepending baseDir.
 */
function toInternalPath(baseDir: string | null, userPath: string): string {
  if (!baseDir) return userPath;
  return `${baseDir}/${userPath}`;
}

/**
 * Translate internal path to user-facing path by stripping baseDir prefix.
 */
function toUserPath(baseDir: string | null, internalPath: string): string {
  if (!baseDir) return internalPath;
  const prefix = `${baseDir}/`;
  if (internalPath.startsWith(prefix)) {
    return internalPath.slice(prefix.length);
  }
  return internalPath;
}

// All document routes require authentication
router.use(requireAuth);

// Vault access check — documents are nested under /vaults/:vaultId/documents
const checkVaultAccess = requireVaultAccess((req) => req.params.vaultId as string);
router.use(checkVaultAccess);

// Fetch vault with baseDir for path translation
router.use(async (req: Request, _res: Response, next: NextFunction) => {
  const vaultId = req.params.vaultId as string;
  const vault = await vaultService.getRow(req.user!.userId, vaultId);
  (req as any).vault = vault;
  next();
});

// GET /vaults/:vaultId/documents — list documents in vault (optionally filtered by ?dir=path)
router.get('/', requireScope('read'), async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const vault = (req as any).vault;
  const userDirPath = req.query.dir as string | undefined;

  // Translate user path to internal path
  const internalDirPath = userDirPath ? toInternalPath(vault.baseDir, userDirPath) : vault.baseDir;

  const docs = await documentService.list(
    req.user!.userId,
    vaultId,
    internalDirPath,
  );

  // Translate paths back to user paths
  const translatedDocs = docs.map(doc => ({
    ...doc,
    path: toUserPath(vault.baseDir, doc.path),
  }));

  res.json({ documents: translatedDocs });
});

// POST /vaults/:vaultId/documents/directories — create empty directory
router.post(
  '/directories',
  requireScope('write'),
  validate(createDirectorySchema),
  async (req: Request, res: Response) => {
    const vaultId = req.params.vaultId as string;
    const vault = (req as any).vault;
    const { path: userDirPath } = req.body;

    // Translate user path to internal path
    const internalDirPath = toInternalPath(vault.baseDir, userDirPath);

    const result = await documentService.createDirectory(
      req.user!.userId,
      vaultId,
      internalDirPath,
    );

    // Translate path back to user path
    res.status(201).json({
      message: result.message,
      path: toUserPath(vault.baseDir, result.path),
    });
  },
);

// GET /vaults/:vaultId/documents/*path/versions — get document versions
// This must be defined before the general wildcard GET to avoid conflicts
router.get('/*path/versions', requireScope('read'), async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const vault = (req as any).vault;
  const userPath = getWildcardPath(req.params);

  // Translate user path to internal path
  const internalPath = toInternalPath(vault.baseDir, userPath);

  // Validate path before proceeding
  validatePath(internalPath);

  const versions = await documentService.getVersions(
    req.user!.userId,
    vaultId,
    internalPath,
  );
  res.json({ versions });
});

// POST /vaults/:vaultId/documents/*path/move — move/rename file or directory
router.post(
  '/*path/move',
  requireScope('write'),
  validate(moveDocumentSchema),
  async (req: Request, res: Response) => {
    const vaultId = req.params.vaultId as string;
    const vault = (req as any).vault;
    const userSourcePath = getWildcardPath(req.params);
    const { destination: userDestPath, overwrite } = req.body;

    // Validate paths before proceeding (use validateDirPath as source/dest could be file or directory)
    validateDirPath(userSourcePath);
    validateDirPath(userDestPath);

    // Translate paths to internal paths
    const internalSourcePath = toInternalPath(vault.baseDir, userSourcePath);
    const internalDestPath = toInternalPath(vault.baseDir, userDestPath);

    const result = await documentService.move(
      req.user!.userId,
      vaultId,
      internalSourcePath,
      internalDestPath,
      overwrite,
    );

    // Translate paths back to user paths
    res.json({
      message: result.message,
      source: toUserPath(vault.baseDir, result.source),
      destination: toUserPath(vault.baseDir, result.destination),
    });
  },
);

// POST /vaults/:vaultId/documents/*path/copy — copy file or directory
router.post(
  '/*path/copy',
  requireScope('write'),
  validate(copyDocumentSchema),
  async (req: Request, res: Response) => {
    const vaultId = req.params.vaultId as string;
    const vault = (req as any).vault;
    const userSourcePath = getWildcardPath(req.params);
    const { destination: userDestPath, overwrite } = req.body;

    // Validate paths before proceeding (use validateDirPath as source/dest could be file or directory)
    validateDirPath(userSourcePath);
    validateDirPath(userDestPath);

    // Translate paths to internal paths
    const internalSourcePath = toInternalPath(vault.baseDir, userSourcePath);
    const internalDestPath = toInternalPath(vault.baseDir, userDestPath);

    const result = await documentService.copy(
      req.user!.userId,
      vaultId,
      internalSourcePath,
      internalDestPath,
      overwrite,
    );

    // Translate paths back to user paths
    res.json({
      message: result.message,
      source: toUserPath(vault.baseDir, result.source),
      destination: toUserPath(vault.baseDir, result.destination),
    });
  },
);

// GET /vaults/:vaultId/documents/*path — get document content + metadata
router.get('/*path', requireScope('read'), async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const vault = (req as any).vault;
  const userPath = getWildcardPath(req.params);

  // Translate user path to internal path
  const internalPath = toInternalPath(vault.baseDir, userPath);

  // Validate path before proceeding
  validatePath(internalPath);

  const result = await documentService.get(
    req.user!.userId,
    vaultId,
    internalPath,
  );

  // Translate path back to user path
  res.json({
    document: {
      ...result.document,
      path: toUserPath(vault.baseDir, result.document.path),
    },
    content: result.content,
  });
});

// PUT /vaults/:vaultId/documents/*path — create/update document
router.put(
  '/*path',
  requireScope('write'),
  validate(putDocumentSchema),
  async (req: Request, res: Response) => {
    const vaultId = req.params.vaultId as string;
    const vault = (req as any).vault;
    const userPath = getWildcardPath(req.params);

    // Translate user path to internal path
    const internalPath = toInternalPath(vault.baseDir, userPath);

    // Validate path before proceeding
    validatePath(internalPath);

    const { content } = req.body;
    const document = await documentService.put(
      req.user!.userId,
      vaultId,
      internalPath,
      content,
      'api',
    );

    // Translate path back to user path
    res.status(200).json({
      document: {
        ...document,
        path: toUserPath(vault.baseDir, document.path),
      },
    });
  },
);

// DELETE /vaults/:vaultId/documents/*path — delete document or directory
router.delete('/*path', requireScope('write'), async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const vault = (req as any).vault;
  const userPath = getWildcardPath(req.params);

  // Translate user path to internal path
  const internalPath = toInternalPath(vault.baseDir, userPath);

  // Validate path before proceeding (use validateDirPath as path could be file or directory)
  validateDirPath(internalPath);

  await documentService.remove(
    req.user!.userId,
    vaultId,
    internalPath,
  );
  res.json({ message: 'Document or directory deleted successfully' });
});

export default router;
