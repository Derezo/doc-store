import { Router, type Request, type Response } from 'express';
import { putDocumentSchema } from '@doc-store/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireScope, requireVaultAccess } from '../middleware/auth.js';
import { validatePath } from '../services/filesystem.service.js';
import * as documentService from '../services/document.service.js';

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

// All document routes require authentication
router.use(requireAuth);

// Vault access check — documents are nested under /vaults/:vaultId/documents
const checkVaultAccess = requireVaultAccess((req) => req.params.vaultId as string);
router.use(checkVaultAccess);

// GET /vaults/:vaultId/documents — list documents in vault (optionally filtered by ?dir=path)
router.get('/', requireScope('read'), async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const dirPath = req.query.dir as string | undefined;
  const docs = await documentService.list(
    req.user!.userId,
    vaultId,
    dirPath,
  );
  res.json({ documents: docs });
});

// GET /vaults/:vaultId/documents/*path/versions — get document versions
// This must be defined before the general wildcard GET to avoid conflicts
router.get('/*path/versions', requireScope('read'), async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const docPath = getWildcardPath(req.params);
  const versions = await documentService.getVersions(
    req.user!.userId,
    vaultId,
    docPath,
  );
  res.json({ versions });
});

// GET /vaults/:vaultId/documents/*path — get document content + metadata
router.get('/*path', requireScope('read'), async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const docPath = getWildcardPath(req.params);
  const result = await documentService.get(
    req.user!.userId,
    vaultId,
    docPath,
  );
  res.json({
    document: result.document,
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
    const docPath = getWildcardPath(req.params);

    // Validate path before proceeding
    validatePath(docPath);

    const { content } = req.body;
    const document = await documentService.put(
      req.user!.userId,
      vaultId,
      docPath,
      content,
      'api',
    );
    res.status(200).json({ document });
  },
);

// DELETE /vaults/:vaultId/documents/*path — delete document
router.delete('/*path', requireScope('write'), async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const docPath = getWildcardPath(req.params);
  await documentService.remove(
    req.user!.userId,
    vaultId,
    docPath,
  );
  res.json({ message: 'Document deleted successfully' });
});

export default router;
