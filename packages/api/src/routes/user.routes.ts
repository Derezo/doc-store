import { Router, type Request, type Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as authService from '../services/auth.service.js';
import * as invitationService from '../services/invitation.service.js';
import { db } from '../db/index.js';
import { vaults, documents } from '../db/schema.js';

const router = Router();

// ── User profile ──────────────────────────────────────────────────────

// GET /users/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await authService.getUserById(req.user!.userId);
  res.json({ user });
});

// GET /users/me/storage — storage usage per vault
router.get('/me/storage', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const vaultRows = await db
    .select({
      vaultId: vaults.id,
      vaultName: vaults.name,
      totalBytes: sql<number>`coalesce(sum(${documents.sizeBytes}), 0)`.as('total_bytes'),
      documentCount: sql<number>`count(${documents.id})`.as('document_count'),
    })
    .from(vaults)
    .leftJoin(documents, eq(vaults.id, documents.vaultId))
    .where(eq(vaults.userId, userId))
    .groupBy(vaults.id, vaults.name)
    .orderBy(vaults.name);

  const vaultStorage = vaultRows.map((row) => ({
    vaultId: row.vaultId,
    name: row.vaultName,
    bytes: Number(row.totalBytes),
    documentCount: Number(row.documentCount),
  }));

  const totalBytes = vaultStorage.reduce((sum, v) => sum + v.bytes, 0);

  res.json({
    totalBytes,
    vaults: vaultStorage,
  });
});

// ── Invitations (admin only) ──────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// POST /users/invite — create invitation + send email
router.post(
  '/invite',
  requireAuth,
  requireAdmin,
  validate(inviteSchema),
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const invitation = await invitationService.create(req.user!.userId, email);
    res.status(201).json({ invitation });
  },
);

// GET /users/invitations — list all invitations
router.get(
  '/invitations',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response) => {
    const invitationsList = await invitationService.list();
    res.json({ invitations: invitationsList });
  },
);

// DELETE /users/invitations/:id — revoke invitation
router.delete(
  '/invitations/:id',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response) => {
    const invitationId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    await invitationService.revoke(req.user!.userId, invitationId);
    res.json({ message: 'Invitation revoked' });
  },
);

export default router;
