import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import {
  userSchema,
  apiErrorResponseSchema,
} from '@doc-store/shared';
import { registry } from './registry.js';

extendZodWithOpenApi(z);

// ── Response schemas for types that only exist as TS interfaces ──────

export const vaultSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi('Vault');

export const documentSchema = z.object({
  id: z.string().uuid(),
  vaultId: z.string().uuid(),
  path: z.string(),
  title: z.string().nullable(),
  contentHash: z.string(),
  sizeBytes: z.number(),
  frontmatter: z.record(z.any()).nullable(),
  tags: z.array(z.string()),
  fileCreatedAt: z.string().nullable(),
  fileModifiedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).openapi('Document');

export const documentVersionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  versionNum: z.number(),
  contentHash: z.string(),
  sizeBytes: z.number(),
  changeSource: z.enum(['web', 'api', 'webdav']),
  changedBy: z.string().nullable(),
  createdAt: z.string(),
}).openapi('DocumentVersion');

// TreeNode is recursive but zod-to-openapi doesn't support z.lazy().
// Define a flat schema and manually set the recursive $ref in the OpenAPI output.
export const treeNodeResponseSchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory']),
  children: z.array(z.any()).optional().openapi({
    description: 'Child nodes (only present for directories). Each child has the same shape as TreeNode.',
  }),
}).openapi('TreeNode');

export const documentListItemSchema = z.object({
  path: z.string(),
  title: z.string().nullable(),
  tags: z.array(z.string()),
  sizeBytes: z.number(),
  fileModifiedAt: z.string(),
}).openapi('DocumentListItem');

export const apiKeyMetaSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  keyPrefix: z.string(),
  scopes: z.array(z.string()),
  vaultId: z.string().uuid().nullable(),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
}).openapi('ApiKeyMeta');

export const searchResultSchema = z.object({
  documentId: z.string().uuid(),
  vaultId: z.string().uuid(),
  vaultName: z.string(),
  path: z.string(),
  title: z.string().nullable(),
  snippet: z.string(),
  tags: z.array(z.string()),
  rank: z.number(),
  fileModifiedAt: z.string(),
}).openapi('SearchResult');

export const searchResponseSchema = z.object({
  results: z.array(searchResultSchema),
  total: z.number(),
  query: z.string(),
}).openapi('SearchResponse');

export const storageVaultSchema = z.object({
  vaultId: z.string().uuid(),
  name: z.string(),
  bytes: z.number(),
  documentCount: z.number(),
}).openapi('StorageVault');

export const storageResponseSchema = z.object({
  totalBytes: z.number(),
  vaults: z.array(storageVaultSchema),
}).openapi('StorageResponse');

export const invitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  invitedBy: z.string().uuid(),
  token: z.string(),
  status: z.enum(['pending', 'accepted', 'revoked']),
  expiresAt: z.string(),
  createdAt: z.string(),
}).openapi('Invitation');

export const createApiKeyResponseSchema = z.object({
  apiKey: apiKeyMetaSchema,
  fullKey: z.string(),
}).openapi('CreateApiKeyResponse');

// ── Security schemes ─────────────────────────────────────────────────

registry.registerComponent('securitySchemes', 'BearerJWT', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT access token obtained from /auth/login or /auth/refresh',
});

registry.registerComponent('securitySchemes', 'BearerApiKey', {
  type: 'http',
  scheme: 'bearer',
  description: 'API key with ds_k_ prefix. Supports read/write scopes.',
});
