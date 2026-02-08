import { z } from 'zod';

export const healthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export const apiErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number().int(),
});

// Auth schemas

export const loginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters'),
  inviteToken: z.string().min(1, 'Invitation token is required'),
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.enum(['admin', 'user']),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const authResponseSchema = z.object({
  user: userSchema,
  accessToken: z.string(),
});

// Vault schemas

export const createVaultSchema = z.object({
  name: z
    .string()
    .min(1, 'Vault name is required')
    .max(100, 'Vault name must be at most 100 characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional(),
});

export const updateVaultSchema = z.object({
  name: z
    .string()
    .min(1, 'Vault name is required')
    .max(100, 'Vault name must be at most 100 characters')
    .optional(),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .nullable()
    .optional(),
});

// Document schemas

export const putDocumentSchema = z.object({
  content: z.string().max(10 * 1024 * 1024, 'Content must be at most 10MB'),
  createIntermediateFolders: z.boolean().optional().default(false),
});

// API Key schemas

export const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API key name is required')
    .max(100, 'API key name must be at most 100 characters'),
  scopes: z
    .array(z.enum(['read', 'write']))
    .min(1, 'At least one scope is required'),
  vaultId: z.string().uuid('Invalid vault ID').optional(),
  expiresAt: z.string().datetime('Invalid expiration date').optional(),
});

export const updateApiKeySchema = z.object({
  name: z
    .string()
    .min(1, 'API key name is required')
    .max(100, 'API key name must be at most 100 characters')
    .optional(),
  isActive: z.boolean().optional(),
});

// Search schemas

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(500, 'Search query too long'),
  vault: z.string().uuid('Invalid vault ID').optional(),
  tags: z.string().optional(), // comma-separated
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});
