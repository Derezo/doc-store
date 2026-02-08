import { Router, type Request, type Response } from 'express';
import { createApiKeySchema, updateApiKeySchema } from '@doc-store/shared';
import { validate } from '../middleware/validate.js';
import { requireJwtAuth } from '../middleware/auth.js';
import * as apiKeyService from '../services/api-key.service.js';

const router = Router();

// All API key management routes require JWT auth (not API key auth)
router.use(requireJwtAuth);

// GET /api-keys — list user's API keys
router.get('/', async (req: Request, res: Response) => {
  const keys = await apiKeyService.list(req.user!.userId);
  res.json({ apiKeys: keys });
});

// POST /api-keys — create API key
router.post(
  '/',
  validate(createApiKeySchema),
  async (req: Request, res: Response) => {
    const { name, scopes, vaultId, expiresAt } = req.body;
    const result = await apiKeyService.create(
      req.user!.userId,
      name,
      scopes,
      vaultId,
      expiresAt,
    );
    res.status(201).json(result);
  },
);

// GET /api-keys/:keyId — get API key details
router.get('/:keyId', async (req: Request, res: Response) => {
  const keyId = req.params.keyId as string;
  const key = await apiKeyService.get(req.user!.userId, keyId);
  res.json({ apiKey: key });
});

// PATCH /api-keys/:keyId — update API key (name, isActive)
router.patch(
  '/:keyId',
  validate(updateApiKeySchema),
  async (req: Request, res: Response) => {
    const keyId = req.params.keyId as string;
    const key = await apiKeyService.update(
      req.user!.userId,
      keyId,
      req.body,
    );
    res.json({ apiKey: key });
  },
);

// DELETE /api-keys/:keyId — delete API key
router.delete('/:keyId', async (req: Request, res: Response) => {
  const keyId = req.params.keyId as string;
  await apiKeyService.remove(req.user!.userId, keyId);
  res.json({ message: 'API key deleted successfully' });
});

export default router;
