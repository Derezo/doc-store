import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';

const router = Router();

// GET /users/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await authService.getUserById(req.user!.userId);
  res.json({ user });
});

export default router;
