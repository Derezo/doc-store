import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { apiKeys } from '../db/schema.js';
import {
  NotFoundError,
  AuthenticationError,
  ValidationError,
} from '../utils/errors.js';
import type { ApiKeyMeta } from '@doc-store/shared';

const API_KEY_PREFIX = 'ds_k_';
const RANDOM_PART_LENGTH = 40;
const KEY_PREFIX_LENGTH = 8;

/**
 * Generate a cryptographically random alphanumeric string of the specified length.
 */
export function generateAlphanumeric(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length * 2); // extra bytes to account for filtering
  let result = '';
  for (let i = 0; i < bytes.length && result.length < length; i++) {
    const idx = bytes[i] % chars.length;
    // Reject biased values to ensure uniform distribution
    if (bytes[i] < Math.floor(256 / chars.length) * chars.length) {
      result += chars[idx];
    }
  }
  // If we somehow didn't get enough chars, recursively fill
  if (result.length < length) {
    result += generateAlphanumeric(length - result.length);
  }
  return result;
}

/**
 * Convert a DB api_key row to a public ApiKeyMeta object.
 */
function toApiKeyMeta(row: typeof apiKeys.$inferSelect): ApiKeyMeta {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes as string[],
    vaultId: row.vaultId,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Create a new API key.
 * Returns the metadata and the full key (shown only once).
 */
export async function create(
  userId: string,
  name: string,
  scopes: string[],
  vaultId?: string,
  expiresAt?: string,
): Promise<{ apiKey: ApiKeyMeta; fullKey: string }> {
  // Generate the random part
  const randomPart = generateAlphanumeric(RANDOM_PART_LENGTH);
  const fullKey = API_KEY_PREFIX + randomPart;
  const keyPrefix = randomPart.slice(0, KEY_PREFIX_LENGTH);

  // Hash the full key with argon2
  const keyHash = await argon2.hash(fullKey);

  // Insert into DB
  const [row] = await db
    .insert(apiKeys)
    .values({
      userId,
      name,
      keyPrefix,
      keyHash,
      scopes,
      vaultId: vaultId ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  return {
    apiKey: toApiKeyMeta(row),
    fullKey,
  };
}

/**
 * List all API keys for a user (never returns hash).
 */
export async function list(userId: string): Promise<ApiKeyMeta[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(apiKeys.createdAt);

  return rows.map(toApiKeyMeta);
}

/**
 * Get a single API key by ID, verifying ownership.
 */
export async function get(userId: string, keyId: string): Promise<ApiKeyMeta> {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .limit(1);

  if (!row) {
    throw new NotFoundError('API key not found');
  }

  return toApiKeyMeta(row);
}

/**
 * Update an API key (name and/or isActive only).
 */
export async function update(
  userId: string,
  keyId: string,
  data: { name?: string; isActive?: boolean },
): Promise<ApiKeyMeta> {
  // Verify ownership
  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('API key not found');
  }

  const updateData: Record<string, any> = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }

  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const [updated] = await db
    .update(apiKeys)
    .set(updateData)
    .where(eq(apiKeys.id, keyId))
    .returning();

  return toApiKeyMeta(updated);
}

/**
 * Hard delete an API key.
 */
export async function remove(userId: string, keyId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('API key not found');
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
}

/**
 * Verify an API key and return user info + scopes.
 *
 * 1. Strip "ds_k_" prefix
 * 2. Extract first 8 chars as key_prefix
 * 3. Query DB for active keys with matching key_prefix
 * 4. Verify full key against argon2 hash
 * 5. Check expiry
 * 6. Update last_used_at async (don't await)
 * 7. Return userId, scopes, vaultId
 */
export async function verifyApiKey(
  fullKey: string,
): Promise<{ userId: string; scopes: string[]; vaultId: string | null }> {
  if (!fullKey.startsWith(API_KEY_PREFIX)) {
    throw new AuthenticationError('Invalid API key format');
  }

  const randomPart = fullKey.slice(API_KEY_PREFIX.length);
  if (randomPart.length !== RANDOM_PART_LENGTH) {
    throw new AuthenticationError('Invalid API key format');
  }

  const keyPrefix = randomPart.slice(0, KEY_PREFIX_LENGTH);

  // Find active keys with matching prefix
  const candidates = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, keyPrefix), eq(apiKeys.isActive, true)));

  if (candidates.length === 0) {
    throw new AuthenticationError('Invalid API key');
  }

  // Verify against each candidate's hash (usually just one)
  for (const candidate of candidates) {
    const valid = await argon2.verify(candidate.keyHash, fullKey);
    if (valid) {
      // Check expiry
      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        throw new AuthenticationError('API key has expired');
      }

      // Update last_used_at asynchronously (fire and forget)
      db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, candidate.id))
        .then(() => {})
        .catch(() => {});

      return {
        userId: candidate.userId,
        scopes: candidate.scopes as string[],
        vaultId: candidate.vaultId,
      };
    }
  }

  throw new AuthenticationError('Invalid API key');
}
