import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import * as apiKeyService from '../services/api-key.service.js';
import * as vaultService from '../services/vault.service.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { getVaultPath } from '../services/filesystem.service.js';
import { logger as rootLogger } from '../utils/logger.js';

const logger = rootLogger.child({ module: 'webdav-auth' });

export interface WebDavAuthResult {
  userId: string;
  vaultId: string;
  vaultSlug: string;
  vaultPath: string;
}

/**
 * Parse Basic Auth header and return email + password (API key).
 */
function parseBasicAuth(authHeader: string): { email: string; apiKey: string } {
  if (!authHeader.startsWith('Basic ')) {
    throw new AuthenticationError('WebDAV requires Basic authentication');
  }

  const encoded = authHeader.slice(6);
  let decoded: string;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    throw new AuthenticationError('Invalid Basic auth encoding');
  }

  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) {
    throw new AuthenticationError('Invalid Basic auth format');
  }

  const email = decoded.slice(0, colonIndex);
  const apiKey = decoded.slice(colonIndex + 1);

  if (!email || !apiKey) {
    throw new AuthenticationError('Email and API key are required');
  }

  return { email, apiKey };
}

/**
 * Authenticate a WebDAV request.
 *
 * Flow:
 * 1. Parse Basic Auth header: base64(email:api_key)
 * 2. Verify API key via apiKeyService.verifyApiKey()
 * 3. Optionally verify the email matches the user (not strictly required,
 *    since the API key already identifies the user)
 * 4. Resolve the vault from the URL's :vaultSlug
 * 5. Verify the user owns the vault
 * 6. If the API key is scoped to a specific vault, verify it matches
 * 7. Return the resolved context
 */
export async function authenticate(
  authHeader: string | undefined,
  vaultSlug: string,
): Promise<WebDavAuthResult> {
  if (!authHeader) {
    throw new AuthenticationError('WebDAV requires Basic authentication');
  }

  // 1. Parse Basic Auth
  const { email, apiKey } = parseBasicAuth(authHeader);

  // 2. Verify API key
  let keyResult: { userId: string; scopes: string[]; vaultId: string | null };
  try {
    keyResult = await apiKeyService.verifyApiKey(apiKey);
  } catch {
    throw new AuthenticationError('Invalid API key');
  }

  // 3. Verify email matches the user (optional but good security)
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, keyResult.userId))
    .limit(1);

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  if (user.email.toLowerCase() !== email.toLowerCase()) {
    logger.warn(
      { userId: keyResult.userId, providedEmail: email },
      'WebDAV auth: email mismatch',
    );
    throw new AuthenticationError('Email does not match API key owner');
  }

  // 4. Resolve vault from slug
  const vault = await vaultService.getBySlug(keyResult.userId, vaultSlug);

  // 5. If API key is scoped to a vault, verify it matches
  if (keyResult.vaultId && keyResult.vaultId !== vault.id) {
    throw new AuthorizationError('API key does not have access to this vault');
  }

  // 6. Verify write scope for WebDAV (which needs read+write)
  if (!keyResult.scopes.includes('write')) {
    throw new AuthorizationError('API key requires write scope for WebDAV access');
  }

  const vaultPath = getVaultPath(keyResult.userId, vault.slug);

  return {
    userId: keyResult.userId,
    vaultId: vault.id,
    vaultSlug: vault.slug,
    vaultPath,
  };
}
