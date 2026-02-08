import { Router, type Request, type Response } from 'express';
import { createVaultSchema, updateVaultSchema } from '@doc-store/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as vaultService from '../services/vault.service.js';
import * as documentService from '../services/document.service.js';

const router = Router();

// All vault routes require authentication
router.use(requireAuth);

// GET /vaults — list user's vaults
router.get('/', async (req: Request, res: Response) => {
  const vaultList = await vaultService.list(req.user!.userId);
  res.json({ vaults: vaultList });
});

// POST /vaults — create vault
router.post(
  '/',
  validate(createVaultSchema),
  async (req: Request, res: Response) => {
    const { name, description } = req.body;
    const vault = await vaultService.create(req.user!.userId, name, description);
    res.status(201).json({ vault });
  },
);

// GET /vaults/:vaultId — get vault details
router.get('/:vaultId', async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const vault = await vaultService.get(req.user!.userId, vaultId);
  res.json({ vault });
});

// PATCH /vaults/:vaultId — update vault
router.patch(
  '/:vaultId',
  validate(updateVaultSchema),
  async (req: Request, res: Response) => {
    const vaultId = req.params.vaultId as string;
    const vault = await vaultService.update(
      req.user!.userId,
      vaultId,
      req.body,
    );
    res.json({ vault });
  },
);

// DELETE /vaults/:vaultId — delete vault
router.delete('/:vaultId', async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  await vaultService.remove(req.user!.userId, vaultId);
  res.json({ message: 'Vault deleted successfully' });
});

// POST /vaults/:vaultId/tree — get full vault tree
router.post('/:vaultId/tree', async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const treeNodes = await documentService.tree(
    req.user!.userId,
    vaultId,
  );
  res.json({ tree: treeNodes });
});

export default router;
