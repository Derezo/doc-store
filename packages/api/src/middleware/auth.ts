import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import * as apiKeyService from '../services/api-key.service.js';

/**
 * Extend Express Request with user payload and optional API key info.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
      apiKey?: {
        scopes: string[];
        vaultId: string | null;
      };
    }
  }
}

/**
 * Middleware that requires a valid JWT or API key in the Authorization header.
 * Attaches user info to req.user. For API keys, also sets req.apiKey.
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

  // API key authentication
  if (token.startsWith('ds_k_')) {
    const result = await apiKeyService.verifyApiKey(token);
    req.user = {
      userId: result.userId,
      email: 'api-key',
      role: 'user',
    };
    req.apiKey = {
      scopes: result.scopes,
      vaultId: result.vaultId,
    };
    next();
    return;
  }

  // JWT authentication
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
 * Middleware that requires JWT auth only (no API keys).
 * Used for API key management endpoints.
 */
export async function requireJwtAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);

  if (token.startsWith('ds_k_')) {
    throw new AuthorizationError('API key management requires JWT authentication');
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

/**
 * Middleware factory that checks if an API key has the required scope.
 * JWT-authenticated requests are allowed all scopes.
 */
export function requireScope(scope: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.apiKey && !req.apiKey.scopes.includes(scope)) {
      throw new AuthorizationError(`API key does not have required scope: ${scope}`);
    }
    next();
  };
}

/**
 * Middleware factory that checks if an API key has access to the requested vault.
 * API keys scoped to a specific vault can only access that vault.
 * JWT-authenticated requests have no vault restriction.
 */
export function requireVaultAccess(getVaultId: (req: Request) => string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.apiKey?.vaultId && req.apiKey.vaultId !== getVaultId(req)) {
      throw new AuthorizationError('API key does not have access to this vault');
    }
    next();
  };
}
