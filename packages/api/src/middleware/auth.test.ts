import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requireAuth,
  requireJwtAuth,
  requireAdmin,
  requireScope,
  requireVaultAccess,
} from './auth.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

// Mock jwt module
vi.mock('../utils/jwt.js', () => ({
  verifyAccessToken: vi.fn(),
}));

// Mock api-key service
vi.mock('../services/api-key.service.js', () => ({
  verifyApiKey: vi.fn(),
}));

import { verifyAccessToken } from '../utils/jwt.js';
import * as apiKeyService from '../services/api-key.service.js';

describe('requireAuth', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {};
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('should throw error when no Authorization header', async () => {
    await expect(requireAuth(mockReq, mockRes, mockNext)).rejects.toThrow(AuthenticationError);
    await expect(requireAuth(mockReq, mockRes, mockNext)).rejects.toThrow('Missing or invalid Authorization header');
  });

  it('should throw error for invalid Authorization format', async () => {
    mockReq.headers.authorization = 'InvalidFormat token';
    await expect(requireAuth(mockReq, mockRes, mockNext)).rejects.toThrow(AuthenticationError);
  });

  it('should authenticate with valid JWT', async () => {
    const mockPayload = {
      sub: 'user123',
      email: 'test@example.com',
      role: 'user',
    };

    vi.mocked(verifyAccessToken).mockResolvedValue(mockPayload as any);
    mockReq.headers.authorization = 'Bearer validjwttoken';

    await requireAuth(mockReq, mockRes, mockNext);

    expect(mockReq.user).toEqual({
      userId: 'user123',
      email: 'test@example.com',
      role: 'user',
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should authenticate with valid API key', async () => {
    const mockApiKeyResult = {
      userId: 'user456',
      scopes: ['read', 'write'],
      vaultId: 'vault123',
    };

    vi.mocked(apiKeyService.verifyApiKey).mockResolvedValue(mockApiKeyResult);
    mockReq.headers.authorization = 'Bearer ds_k_abc123xyz';

    await requireAuth(mockReq, mockRes, mockNext);

    expect(mockReq.user).toEqual({
      userId: 'user456',
      email: 'api-key',
      role: 'user',
    });
    expect(mockReq.apiKey).toEqual({
      scopes: ['read', 'write'],
      vaultId: 'vault123',
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should throw error for invalid JWT', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(new Error('Invalid token'));
    mockReq.headers.authorization = 'Bearer invalidtoken';

    await expect(requireAuth(mockReq, mockRes, mockNext)).rejects.toThrow(AuthenticationError);
    await expect(requireAuth(mockReq, mockRes, mockNext)).rejects.toThrow('Invalid or expired token');
  });
});

describe('requireJwtAuth', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = { headers: {} };
    mockRes = {};
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('should authenticate with valid JWT', async () => {
    const mockPayload = {
      sub: 'user123',
      email: 'test@example.com',
      role: 'admin',
    };

    vi.mocked(verifyAccessToken).mockResolvedValue(mockPayload as any);
    mockReq.headers.authorization = 'Bearer validjwttoken';

    await requireJwtAuth(mockReq, mockRes, mockNext);

    expect(mockReq.user).toEqual({
      userId: 'user123',
      email: 'test@example.com',
      role: 'admin',
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject API key', async () => {
    mockReq.headers.authorization = 'Bearer ds_k_abc123xyz';

    await expect(requireJwtAuth(mockReq, mockRes, mockNext)).rejects.toThrow(AuthorizationError);
    await expect(requireJwtAuth(mockReq, mockRes, mockNext)).rejects.toThrow('API key management requires JWT authentication');
  });

  it('should throw error when no Authorization header', async () => {
    await expect(requireJwtAuth(mockReq, mockRes, mockNext)).rejects.toThrow(AuthenticationError);
  });

  it('should throw error for invalid JWT', async () => {
    vi.mocked(verifyAccessToken).mockRejectedValue(new Error('Invalid'));
    mockReq.headers.authorization = 'Bearer invalidtoken';

    await expect(requireJwtAuth(mockReq, mockRes, mockNext)).rejects.toThrow(AuthenticationError);
  });
});

describe('requireAdmin', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = vi.fn();
  });

  it('should allow admin user', async () => {
    mockReq.user = { userId: 'user123', email: 'admin@example.com', role: 'admin' };

    await requireAdmin(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject non-admin user', async () => {
    mockReq.user = { userId: 'user123', email: 'user@example.com', role: 'user' };

    await expect(requireAdmin(mockReq, mockRes, mockNext)).rejects.toThrow(AuthorizationError);
    await expect(requireAdmin(mockReq, mockRes, mockNext)).rejects.toThrow('Admin access required');
  });

  it('should throw error when no user', async () => {
    await expect(requireAdmin(mockReq, mockRes, mockNext)).rejects.toThrow(AuthenticationError);
    await expect(requireAdmin(mockReq, mockRes, mockNext)).rejects.toThrow('Authentication required');
  });
});

describe('requireScope', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = vi.fn();
  });

  it('should allow JWT-authenticated requests', () => {
    mockReq.user = { userId: 'user123', email: 'test@example.com', role: 'user' };
    // No apiKey means JWT auth

    const middleware = requireScope('write');
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should allow API key with required scope', () => {
    mockReq.apiKey = { scopes: ['read', 'write'], vaultId: null };

    const middleware = requireScope('write');
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject API key without required scope', () => {
    mockReq.apiKey = { scopes: ['read'], vaultId: null };

    const middleware = requireScope('write');

    expect(() => middleware(mockReq, mockRes, mockNext)).toThrow(AuthorizationError);
    expect(() => middleware(mockReq, mockRes, mockNext)).toThrow('API key does not have required scope: write');
  });

  it('should allow API key with multiple scopes', () => {
    mockReq.apiKey = { scopes: ['read', 'write', 'delete'], vaultId: null };

    const middleware = requireScope('read');
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('requireVaultAccess', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = { params: {} };
    mockRes = {};
    mockNext = vi.fn();
  });

  it('should allow JWT-authenticated requests', () => {
    mockReq.user = { userId: 'user123', email: 'test@example.com', role: 'user' };
    mockReq.params.vaultId = 'vault123';

    const middleware = requireVaultAccess((req) => req.params.vaultId as string);
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should allow API key with matching vault', () => {
    mockReq.apiKey = { scopes: ['read'], vaultId: 'vault123' };
    mockReq.params.vaultId = 'vault123';

    const middleware = requireVaultAccess((req) => req.params.vaultId as string);
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should reject API key with different vault', () => {
    mockReq.apiKey = { scopes: ['read'], vaultId: 'vault123' };
    mockReq.params.vaultId = 'vault456';

    const middleware = requireVaultAccess((req) => req.params.vaultId as string);

    expect(() => middleware(mockReq, mockRes, mockNext)).toThrow(AuthorizationError);
    expect(() => middleware(mockReq, mockRes, mockNext)).toThrow('API key does not have access to this vault');
  });

  it('should allow API key with null vault (not scoped)', () => {
    mockReq.apiKey = { scopes: ['read', 'write'], vaultId: null };
    mockReq.params.vaultId = 'vault123';

    const middleware = requireVaultAccess((req) => req.params.vaultId as string);
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
