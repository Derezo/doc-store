import { Router, type Request, type Response } from 'express';
import { searchQuerySchema } from '@doc-store/shared';
import { requireAuth, requireScope } from '../middleware/auth.js';
import * as searchService from '../services/search.service.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

// All search routes require authentication
router.use(requireAuth);

/**
 * GET /api/v1/search?q=<query>&vault=<vaultId>&tags=<tag1,tag2>&limit=20&offset=0
 *
 * Full-text search across documents in vaults owned by the authenticated user.
 * For API key auth, respects vault scoping.
 */
router.get('/', requireScope('read'), async (req: Request, res: Response) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.errors.map((e) => e.message).join(', '),
    );
  }

  const { q, vault, tags: tagsStr, limit, offset } = parsed.data;

  // Parse comma-separated tags
  const tags = tagsStr
    ? tagsStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    : undefined;

  const result = await searchService.search({
    query: q,
    userId: req.user!.userId,
    vaultId: vault,
    tags,
    limit,
    offset,
    apiKeyVaultId: req.apiKey?.vaultId ?? null,
  });

  res.json(result);
});

export default router;
