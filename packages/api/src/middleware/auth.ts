import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

/**
 * Extend Express Request with user payload.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware that requires a valid JWT in the Authorization header.
 * Attaches user info to req.user.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  // Skip API key tokens for now (Phase 3)
  if (token.startsWith('ds_k_')) {
    throw new AuthenticationError('API key authentication not yet supported');
  }

  try {
    const payload = await verifyAccessToken(token);
    req.user = {
      userId: payload.sub!,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    throw new AuthenticationError('Invalid or expired token');
  }
}

/**
 * Middleware that requires the authenticated user to have the 'admin' role.
 * Must be used after requireAuth.
 */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }

  if (req.user.role !== 'admin') {
    throw new AuthorizationError('Admin access required');
  }

  next();
}
