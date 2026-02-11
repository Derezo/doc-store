import { Router, type Request, type Response } from 'express';
import { createVaultSchema, updateVaultSchema, type TreeNode } from '@doc-store/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireScope, requireVaultAccess } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import * as vaultService from '../services/vault.service.js';
import * as documentService from '../services/document.service.js';
import * as filesystemService from '../services/filesystem.service.js';

const router = Router();

/**
 * Apply baseDir filtering to tree nodes.
 * Promotes baseDir contents to top level and dims items outside baseDir.
 */
function applyBaseDirFilter(nodes: TreeNode[], baseDir: string): TreeNode[] {
  // Find the baseDir node
  const parts = baseDir.split('/');
  let current = nodes;
  let baseDirNode: TreeNode | undefined;

  for (const part of parts) {
    baseDirNode = current.find(n => n.name === part && n.type === 'directory');
    if (!baseDirNode || !baseDirNode.children) {
      // baseDir not found in tree, return original
      return nodes;
    }
    current = baseDirNode.children;
  }

  // Strip baseDir prefix from promoted children
  function stripPrefix(node: TreeNode, prefix: string): TreeNode {
    const prefixWithSlash = `${prefix}/`;
    const newPath = node.path.startsWith(prefixWithSlash)
      ? node.path.slice(prefixWithSlash.length)
      : node.path;

    return {
      ...node,
      path: newPath,
      children: node.children?.map(child => stripPrefix(child, prefix)),
    };
  }

  // Mark all nodes outside baseDir as dimmed
  function markDimmed(node: TreeNode): TreeNode {
    return {
      ...node,
      dimmed: true,
      children: node.children?.map(markDimmed),
    };
  }

  // Build result: promoted baseDir children + dimmed other nodes
  const promotedChildren = current.map(child => stripPrefix(child, baseDir));
  const dimmedOthers = nodes
    .filter(n => n !== baseDirNode)
    .map(markDimmed);

  return [...promotedChildren, ...dimmedOthers];
}

// All vault routes require authentication
router.use(requireAuth);

// Vault access check for routes with :vaultId
const checkVaultAccess = requireVaultAccess((req) => req.params.vaultId as string);

// GET /vaults — list user's vaults
router.get('/', requireScope('read'), async (req: Request, res: Response) => {
  const vaultList = await vaultService.list(req.user!.userId);
  res.json({ vaults: vaultList });
});

// POST /vaults — create vault
router.post(
  '/',
  requireScope('write'),
  validate(createVaultSchema),
  async (req: Request, res: Response) => {
    const { name, description } = req.body;
    const vault = await vaultService.create(req.user!.userId, name, description);
    res.status(201).json({ vault });
  },
);

// GET /vaults/:vaultId — get vault details
router.get('/:vaultId', requireScope('read'), checkVaultAccess, async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const vault = await vaultService.get(req.user!.userId, vaultId);
  res.json({ vault });
});

// PATCH /vaults/:vaultId — update vault
router.patch(
  '/:vaultId',
  requireScope('write'),
  checkVaultAccess,
  validate(updateVaultSchema),
  async (req: Request, res: Response) => {
    const vaultId = req.params.vaultId as string;

    // Validate baseDir if being set
    if (req.body.baseDir !== undefined && req.body.baseDir !== null) {
      const vault = await vaultService.getRow(req.user!.userId, vaultId);
      const vaultPath = filesystemService.getVaultPath(req.user!.userId, vault.slug);
      const exists = await filesystemService.pathExists(vaultPath, req.body.baseDir);
      if (exists !== 'directory') {
        throw new ValidationError('Base directory does not exist');
      }
    }

    const vault = await vaultService.update(
      req.user!.userId,
      vaultId,
      req.body,
    );
    res.json({ vault });
  },
);

// DELETE /vaults/:vaultId — delete vault
router.delete('/:vaultId', requireScope('write'), checkVaultAccess, async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  await vaultService.remove(req.user!.userId, vaultId);
  res.json({ message: 'Vault deleted successfully' });
});

// GET /vaults/:vaultId/tree — get full vault tree
router.get('/:vaultId/tree', requireScope('read'), checkVaultAccess, async (req: Request, res: Response) => {
  const vaultId = req.params.vaultId as string;
  const vault = await vaultService.getRow(req.user!.userId, vaultId);
  const treeNodes = await documentService.tree(
    req.user!.userId,
    vaultId,
  );

  if (vault.baseDir) {
    // Apply baseDir filtering: promote baseDir contents to top level,
    // dim items outside baseDir
    const filtered = applyBaseDirFilter(treeNodes, vault.baseDir);
    res.json({ tree: filtered });
  } else {
    res.json({ tree: treeNodes });
  }
});

export default router;
