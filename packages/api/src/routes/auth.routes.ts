import { Router, type Request, type Response } from 'express';
import { loginRequestSchema, registerRequestSchema } from '@doc-store/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';

const router = Router();

const REFRESH_COOKIE = 'doc_store_refresh';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
}

// POST /auth/register
router.post(
  '/register',
  validate(registerRequestSchema),
  async (req: Request, res: Response) => {
    const { email, password, displayName, inviteToken } = req.body;

    const result = await authService.register(email, password, displayName, inviteToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    setRefreshCookie(res, result.refreshToken);

    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  },
);

// POST /auth/login
router.post(
  '/login',
  validate(loginRequestSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const result = await authService.login(email, password, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    setRefreshCookie(res, result.refreshToken);

    res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  },
);

// POST /auth/refresh
// Requires X-Requested-With header for CSRF protection (cannot be sent cross-origin without CORS)
router.post('/refresh', async (req: Request, res: Response) => {
  if (!req.headers['x-requested-with']) {
    res.status(403).json({
      error: 'CSRF_ERROR',
      message: 'Missing X-Requested-With header',
      statusCode: 403,
    });
    return;
  }

  const refreshToken = req.cookies?.[REFRESH_COOKIE];

  if (!refreshToken) {
    res.status(401).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'No refresh token provided',
      statusCode: 401,
    });
    return;
  }

  const result = await authService.refresh(refreshToken, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  setRefreshCookie(res, result.refreshToken);

  res.json({
    user: result.user,
    accessToken: result.accessToken,
  });
});

// POST /auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  await authService.logout(req.user!.userId, refreshToken);
  clearRefreshCookie(res);
  res.json({ message: 'Logged out successfully' });
});

export default router;
