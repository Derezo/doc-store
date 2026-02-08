import { describe, it, expect } from 'vitest';
import {
  healthCheckResponseSchema,
  apiErrorResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  userSchema,
  authResponseSchema,
  createVaultSchema,
  updateVaultSchema,
  putDocumentSchema,
  createApiKeySchema,
  updateApiKeySchema,
  searchQuerySchema,
} from './index.js';

describe('healthCheckResponseSchema', () => {
  it('should accept valid health check response', () => {
    const validData = {
      status: 'ok' as const,
      timestamp: '2026-02-08T10:30:00.000Z',
    };
    expect(healthCheckResponseSchema.parse(validData)).toEqual(validData);
  });

  it('should reject invalid status', () => {
    const invalidData = {
      status: 'healthy',
      timestamp: '2026-02-08T10:30:00.000Z',
    };
    expect(() => healthCheckResponseSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid datetime format', () => {
    const invalidData = {
      status: 'ok' as const,
      timestamp: '2026-02-08',
    };
    expect(() => healthCheckResponseSchema.parse(invalidData)).toThrow();
  });

  it('should reject missing timestamp', () => {
    const invalidData = {
      status: 'ok' as const,
    };
    expect(() => healthCheckResponseSchema.parse(invalidData)).toThrow();
  });
});

describe('apiErrorResponseSchema', () => {
  it('should accept valid error response', () => {
    const validData = {
      error: 'ValidationError',
      message: 'Invalid input provided',
      statusCode: 400,
    };
    expect(apiErrorResponseSchema.parse(validData)).toEqual(validData);
  });

  it('should reject non-integer status code', () => {
    const invalidData = {
      error: 'Error',
      message: 'Something went wrong',
      statusCode: 400.5,
    };
    expect(() => apiErrorResponseSchema.parse(invalidData)).toThrow();
  });

  it('should reject missing error field', () => {
    const invalidData = {
      message: 'Something went wrong',
      statusCode: 500,
    };
    expect(() => apiErrorResponseSchema.parse(invalidData)).toThrow();
  });

  it('should reject missing message field', () => {
    const invalidData = {
      error: 'Error',
      statusCode: 500,
    };
    expect(() => apiErrorResponseSchema.parse(invalidData)).toThrow();
  });
});

describe('loginRequestSchema', () => {
  it('should accept valid login credentials', () => {
    const validData = {
      email: 'user@example.com',
      password: 'password123',
    };
    expect(loginRequestSchema.parse(validData)).toEqual(validData);
  });

  it('should reject invalid email format', () => {
    const invalidData = {
      email: 'not-an-email',
      password: 'password123',
    };
    expect(() => loginRequestSchema.parse(invalidData)).toThrow('Invalid email address');
  });

  it('should reject empty password', () => {
    const invalidData = {
      email: 'user@example.com',
      password: '',
    };
    expect(() => loginRequestSchema.parse(invalidData)).toThrow('Password is required');
  });

  it('should reject missing email', () => {
    const invalidData = {
      password: 'password123',
    };
    expect(() => loginRequestSchema.parse(invalidData)).toThrow();
  });

  it('should reject missing password', () => {
    const invalidData = {
      email: 'user@example.com',
    };
    expect(() => loginRequestSchema.parse(invalidData)).toThrow();
  });
});

describe('registerRequestSchema', () => {
  it('should accept valid registration data', () => {
    const validData = {
      email: 'newuser@example.com',
      password: 'securePassword123',
      displayName: 'John Doe',
      inviteToken: 'abc123def456',
    };
    expect(registerRequestSchema.parse(validData)).toEqual(validData);
  });

  it('should reject password shorter than 8 characters', () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'short',
      displayName: 'John Doe',
      inviteToken: 'token123',
    };
    expect(() => registerRequestSchema.parse(invalidData)).toThrow('Password must be at least 8 characters');
  });

  it('should reject password longer than 128 characters', () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'a'.repeat(129),
      displayName: 'John Doe',
      inviteToken: 'token123',
    };
    expect(() => registerRequestSchema.parse(invalidData)).toThrow('Password must be at most 128 characters');
  });

  it('should accept password exactly 8 characters', () => {
    const validData = {
      email: 'user@example.com',
      password: '12345678',
      displayName: 'John Doe',
      inviteToken: 'token123',
    };
    expect(registerRequestSchema.parse(validData)).toEqual(validData);
  });

  it('should accept password exactly 128 characters', () => {
    const validData = {
      email: 'user@example.com',
      password: 'a'.repeat(128),
      displayName: 'John Doe',
      inviteToken: 'token123',
    };
    expect(registerRequestSchema.parse(validData)).toEqual(validData);
  });

  it('should reject empty display name', () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'password123',
      displayName: '',
      inviteToken: 'token123',
    };
    expect(() => registerRequestSchema.parse(invalidData)).toThrow('Display name is required');
  });

  it('should reject display name longer than 100 characters', () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'password123',
      displayName: 'a'.repeat(101),
      inviteToken: 'token123',
    };
    expect(() => registerRequestSchema.parse(invalidData)).toThrow('Display name must be at most 100 characters');
  });

  it('should accept display name exactly 100 characters', () => {
    const validData = {
      email: 'user@example.com',
      password: 'password123',
      displayName: 'a'.repeat(100),
      inviteToken: 'token123',
    };
    expect(registerRequestSchema.parse(validData)).toEqual(validData);
  });

  it('should reject empty invite token', () => {
    const invalidData = {
      email: 'user@example.com',
      password: 'password123',
      displayName: 'John Doe',
      inviteToken: '',
    };
    expect(() => registerRequestSchema.parse(invalidData)).toThrow('Invitation token is required');
  });

  it('should reject invalid email format', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'password123',
      displayName: 'John Doe',
      inviteToken: 'token123',
    };
    expect(() => registerRequestSchema.parse(invalidData)).toThrow('Invalid email address');
  });
});

describe('userSchema', () => {
  it('should accept valid user data', () => {
    const validData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      displayName: 'John Doe',
      role: 'user' as const,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-08T10:30:00.000Z',
    };
    expect(userSchema.parse(validData)).toEqual(validData);
  });

  it('should accept admin role', () => {
    const validData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'admin@example.com',
      displayName: 'Admin User',
      role: 'admin' as const,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-08T10:30:00.000Z',
    };
    expect(userSchema.parse(validData)).toEqual(validData);
  });

  it('should reject invalid UUID', () => {
    const invalidData = {
      id: 'not-a-uuid',
      email: 'user@example.com',
      displayName: 'John Doe',
      role: 'user',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-08T10:30:00.000Z',
    };
    expect(() => userSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid role', () => {
    const invalidData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      displayName: 'John Doe',
      role: 'superadmin',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-08T10:30:00.000Z',
    };
    expect(() => userSchema.parse(invalidData)).toThrow();
  });

  it('should reject non-boolean isActive', () => {
    const invalidData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      displayName: 'John Doe',
      role: 'user',
      isActive: 'true',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-08T10:30:00.000Z',
    };
    expect(() => userSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid email format', () => {
    const invalidData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'invalid-email',
      displayName: 'John Doe',
      role: 'user',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-08T10:30:00.000Z',
    };
    expect(() => userSchema.parse(invalidData)).toThrow();
  });
});

describe('authResponseSchema', () => {
  it('should accept valid auth response', () => {
    const validData = {
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        displayName: 'John Doe',
        role: 'user' as const,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-08T10:30:00.000Z',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    };
    expect(authResponseSchema.parse(validData)).toEqual(validData);
  });

  it('should reject invalid user data', () => {
    const invalidData = {
      user: {
        id: 'not-a-uuid',
        email: 'user@example.com',
        displayName: 'John Doe',
        role: 'user',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-08T10:30:00.000Z',
      },
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    };
    expect(() => authResponseSchema.parse(invalidData)).toThrow();
  });

  it('should reject missing access token', () => {
    const invalidData = {
      user: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'user@example.com',
        displayName: 'John Doe',
        role: 'user',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-02-08T10:30:00.000Z',
      },
    };
    expect(() => authResponseSchema.parse(invalidData)).toThrow();
  });
});

describe('createVaultSchema', () => {
  it('should accept valid vault data with description', () => {
    const validData = {
      name: 'My Vault',
      description: 'A vault for personal notes',
    };
    expect(createVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should accept valid vault data without description', () => {
    const validData = {
      name: 'My Vault',
    };
    expect(createVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
      description: 'A vault',
    };
    expect(() => createVaultSchema.parse(invalidData)).toThrow('Vault name is required');
  });

  it('should reject name longer than 100 characters', () => {
    const invalidData = {
      name: 'a'.repeat(101),
      description: 'A vault',
    };
    expect(() => createVaultSchema.parse(invalidData)).toThrow('Vault name must be at most 100 characters');
  });

  it('should accept name exactly 100 characters', () => {
    const validData = {
      name: 'a'.repeat(100),
    };
    expect(createVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should reject description longer than 1000 characters', () => {
    const invalidData = {
      name: 'My Vault',
      description: 'a'.repeat(1001),
    };
    expect(() => createVaultSchema.parse(invalidData)).toThrow('Description must be at most 1000 characters');
  });

  it('should accept description exactly 1000 characters', () => {
    const validData = {
      name: 'My Vault',
      description: 'a'.repeat(1000),
    };
    expect(createVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should reject missing name', () => {
    const invalidData = {
      description: 'A vault',
    };
    expect(() => createVaultSchema.parse(invalidData)).toThrow();
  });
});

describe('updateVaultSchema', () => {
  it('should accept valid update with name only', () => {
    const validData = {
      name: 'Updated Vault Name',
    };
    expect(updateVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should accept valid update with description only', () => {
    const validData = {
      description: 'Updated description',
    };
    expect(updateVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should accept valid update with both fields', () => {
    const validData = {
      name: 'Updated Vault Name',
      description: 'Updated description',
    };
    expect(updateVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should accept null description', () => {
    const validData = {
      description: null,
    };
    expect(updateVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should accept empty update object', () => {
    const validData = {};
    expect(updateVaultSchema.parse(validData)).toEqual(validData);
  });

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
    };
    expect(() => updateVaultSchema.parse(invalidData)).toThrow('Vault name is required');
  });

  it('should reject name longer than 100 characters', () => {
    const invalidData = {
      name: 'a'.repeat(101),
    };
    expect(() => updateVaultSchema.parse(invalidData)).toThrow('Vault name must be at most 100 characters');
  });

  it('should reject description longer than 1000 characters', () => {
    const invalidData = {
      description: 'a'.repeat(1001),
    };
    expect(() => updateVaultSchema.parse(invalidData)).toThrow('Description must be at most 1000 characters');
  });
});

describe('putDocumentSchema', () => {
  it('should accept valid document with default createIntermediateFolders', () => {
    const validData = {
      content: '# Hello World\n\nThis is my document.',
    };
    const parsed = putDocumentSchema.parse(validData);
    expect(parsed.content).toBe(validData.content);
    expect(parsed.createIntermediateFolders).toBe(false);
  });

  it('should accept valid document with createIntermediateFolders=true', () => {
    const validData = {
      content: '# Hello World',
      createIntermediateFolders: true,
    };
    const parsed = putDocumentSchema.parse(validData);
    expect(parsed.createIntermediateFolders).toBe(true);
  });

  it('should accept valid document with createIntermediateFolders=false', () => {
    const validData = {
      content: '# Hello World',
      createIntermediateFolders: false,
    };
    const parsed = putDocumentSchema.parse(validData);
    expect(parsed.createIntermediateFolders).toBe(false);
  });

  it('should accept empty content', () => {
    const validData = {
      content: '',
    };
    const parsed = putDocumentSchema.parse(validData);
    expect(parsed.content).toBe('');
    expect(parsed.createIntermediateFolders).toBe(false);
  });

  it('should reject content larger than 10MB', () => {
    const invalidData = {
      content: 'a'.repeat(10 * 1024 * 1024 + 1),
    };
    expect(() => putDocumentSchema.parse(invalidData)).toThrow('Content must be at most 10MB');
  });

  it('should accept content exactly 10MB', () => {
    const validData = {
      content: 'a'.repeat(10 * 1024 * 1024),
    };
    const parsed = putDocumentSchema.parse(validData);
    expect(parsed.content.length).toBe(10 * 1024 * 1024);
  });

  it('should reject missing content', () => {
    const invalidData = {
      createIntermediateFolders: true,
    };
    expect(() => putDocumentSchema.parse(invalidData)).toThrow();
  });

  it('should reject non-string content', () => {
    const invalidData = {
      content: 12345,
    };
    expect(() => putDocumentSchema.parse(invalidData)).toThrow();
  });
});

describe('createApiKeySchema', () => {
  it('should accept valid API key with all fields', () => {
    const validData = {
      name: 'Production API Key',
      scopes: ['read', 'write'] as const,
      vaultId: '550e8400-e29b-41d4-a716-446655440000',
      expiresAt: '2027-02-08T10:30:00.000Z',
    };
    expect(createApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should accept valid API key with only required fields', () => {
    const validData = {
      name: 'Production API Key',
      scopes: ['read'] as const,
    };
    expect(createApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should accept read-only scope', () => {
    const validData = {
      name: 'Read Only Key',
      scopes: ['read'] as const,
    };
    expect(createApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should accept write-only scope', () => {
    const validData = {
      name: 'Write Only Key',
      scopes: ['write'] as const,
    };
    expect(createApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should accept both read and write scopes', () => {
    const validData = {
      name: 'Full Access Key',
      scopes: ['read', 'write'] as const,
    };
    expect(createApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should reject empty scopes array', () => {
    const invalidData = {
      name: 'My Key',
      scopes: [],
    };
    expect(() => createApiKeySchema.parse(invalidData)).toThrow('At least one scope is required');
  });

  it('should reject invalid scope', () => {
    const invalidData = {
      name: 'My Key',
      scopes: ['admin'],
    };
    expect(() => createApiKeySchema.parse(invalidData)).toThrow();
  });

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
      scopes: ['read'],
    };
    expect(() => createApiKeySchema.parse(invalidData)).toThrow('API key name is required');
  });

  it('should reject name longer than 100 characters', () => {
    const invalidData = {
      name: 'a'.repeat(101),
      scopes: ['read'],
    };
    expect(() => createApiKeySchema.parse(invalidData)).toThrow('API key name must be at most 100 characters');
  });

  it('should accept name exactly 100 characters', () => {
    const validData = {
      name: 'a'.repeat(100),
      scopes: ['read'] as const,
    };
    expect(createApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should reject invalid vault ID format', () => {
    const invalidData = {
      name: 'My Key',
      scopes: ['read'],
      vaultId: 'not-a-uuid',
    };
    expect(() => createApiKeySchema.parse(invalidData)).toThrow('Invalid vault ID');
  });

  it('should reject invalid expiresAt format', () => {
    const invalidData = {
      name: 'My Key',
      scopes: ['read'],
      expiresAt: '2027-02-08',
    };
    expect(() => createApiKeySchema.parse(invalidData)).toThrow('Invalid expiration date');
  });
});

describe('updateApiKeySchema', () => {
  it('should accept valid update with name only', () => {
    const validData = {
      name: 'Updated Key Name',
    };
    expect(updateApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should accept valid update with isActive only', () => {
    const validData = {
      isActive: false,
    };
    expect(updateApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should accept valid update with both fields', () => {
    const validData = {
      name: 'Updated Key Name',
      isActive: true,
    };
    expect(updateApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should accept empty update object', () => {
    const validData = {};
    expect(updateApiKeySchema.parse(validData)).toEqual(validData);
  });

  it('should reject empty name', () => {
    const invalidData = {
      name: '',
    };
    expect(() => updateApiKeySchema.parse(invalidData)).toThrow('API key name is required');
  });

  it('should reject name longer than 100 characters', () => {
    const invalidData = {
      name: 'a'.repeat(101),
    };
    expect(() => updateApiKeySchema.parse(invalidData)).toThrow('API key name must be at most 100 characters');
  });

  it('should reject non-boolean isActive', () => {
    const invalidData = {
      isActive: 'true',
    };
    expect(() => updateApiKeySchema.parse(invalidData)).toThrow();
  });
});

describe('searchQuerySchema', () => {
  it('should accept valid search with all fields', () => {
    const validData = {
      q: 'typescript tutorial',
      vault: '550e8400-e29b-41d4-a716-446655440000',
      tags: 'coding,typescript',
      limit: 50,
      offset: 10,
    };
    expect(searchQuerySchema.parse(validData)).toEqual(validData);
  });

  it('should accept valid search with only required field', () => {
    const validData = {
      q: 'search query',
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.q).toBe('search query');
    expect(parsed.limit).toBe(20);
    expect(parsed.offset).toBe(0);
  });

  it('should apply default limit of 20', () => {
    const validData = {
      q: 'test',
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.limit).toBe(20);
  });

  it('should apply default offset of 0', () => {
    const validData = {
      q: 'test',
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.offset).toBe(0);
  });

  it('should coerce string limit to number', () => {
    const validData = {
      q: 'test',
      limit: '30' as any,
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.limit).toBe(30);
  });

  it('should coerce string offset to number', () => {
    const validData = {
      q: 'test',
      offset: '5' as any,
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.offset).toBe(5);
  });

  it('should reject empty query', () => {
    const invalidData = {
      q: '',
    };
    expect(() => searchQuerySchema.parse(invalidData)).toThrow('Search query is required');
  });

  it('should reject query longer than 500 characters', () => {
    const invalidData = {
      q: 'a'.repeat(501),
    };
    expect(() => searchQuerySchema.parse(invalidData)).toThrow('Search query too long');
  });

  it('should accept query exactly 500 characters', () => {
    const validData = {
      q: 'a'.repeat(500),
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.q.length).toBe(500);
  });

  it('should reject limit less than 1', () => {
    const invalidData = {
      q: 'test',
      limit: 0,
    };
    expect(() => searchQuerySchema.parse(invalidData)).toThrow();
  });

  it('should reject limit greater than 100', () => {
    const invalidData = {
      q: 'test',
      limit: 101,
    };
    expect(() => searchQuerySchema.parse(invalidData)).toThrow();
  });

  it('should accept limit of 1', () => {
    const validData = {
      q: 'test',
      limit: 1,
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.limit).toBe(1);
  });

  it('should accept limit of 100', () => {
    const validData = {
      q: 'test',
      limit: 100,
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.limit).toBe(100);
  });

  it('should reject negative offset', () => {
    const invalidData = {
      q: 'test',
      offset: -1,
    };
    expect(() => searchQuerySchema.parse(invalidData)).toThrow();
  });

  it('should accept offset of 0', () => {
    const validData = {
      q: 'test',
      offset: 0,
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.offset).toBe(0);
  });

  it('should reject invalid vault ID format', () => {
    const invalidData = {
      q: 'test',
      vault: 'not-a-uuid',
    };
    expect(() => searchQuerySchema.parse(invalidData)).toThrow('Invalid vault ID');
  });

  it('should accept missing vault ID', () => {
    const validData = {
      q: 'test',
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.vault).toBeUndefined();
  });

  it('should accept missing tags', () => {
    const validData = {
      q: 'test',
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.tags).toBeUndefined();
  });

  it('should accept comma-separated tags', () => {
    const validData = {
      q: 'test',
      tags: 'tag1,tag2,tag3',
    };
    const parsed = searchQuerySchema.parse(validData);
    expect(parsed.tags).toBe('tag1,tag2,tag3');
  });
});
