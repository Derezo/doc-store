import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vaults } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import * as filesystemService from './filesystem.service.js';
import type { Vault } from '@doc-store/shared';

/**
 * Convert a DB vault row to a public Vault object.
 */
function toPublicVault(row: typeof vaults.$inferSelect): Vault {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Generate a URL-safe slug from a vault name.
 * Lowercase, spaces to hyphens, remove special chars, dedupe hyphens.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Create a new vault.
 */
export async function create(
  userId: string,
  name: string,
  description?: string,
): Promise<Vault> {
  const slug = slugify(name);

  if (!slug) {
    throw new Error('Vault name must contain at least one alphanumeric character');
  }

  // Check for slug collision
  const [existing] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.userId, userId), eq(vaults.slug, slug)))
    .limit(1);

  if (existing) {
    throw new ConflictError(`A vault with the slug "${slug}" already exists`);
  }

  // Insert into DB
  const [vault] = await db
    .insert(vaults)
    .values({
      userId,
      name,
      slug,
      description: description ?? null,
    })
    .returning();

  // Create filesystem directory
  await filesystemService.ensureVaultDir(userId, slug);

  return toPublicVault(vault);
}

/**
 * List all vaults for a user.
 */
export async function list(userId: string): Promise<Vault[]> {
  const rows = await db
    .select()
    .from(vaults)
    .where(eq(vaults.userId, userId))
    .orderBy(vaults.name);

  return rows.map(toPublicVault);
}

/**
 * Get a vault by ID, verifying ownership.
 */
export async function get(userId: string, vaultId: string): Promise<Vault> {
  const [vault] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId)))
    .limit(1);

  if (!vault) {
    throw new NotFoundError('Vault not found');
  }

  return toPublicVault(vault);
}

/**
 * Get the raw DB vault row (for internal use by other services).
 */
export async function getRow(
  userId: string,
  vaultId: string,
): Promise<typeof vaults.$inferSelect> {
  const [vault] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.id, vaultId), eq(vaults.userId, userId)))
    .limit(1);

  if (!vault) {
    throw new NotFoundError('Vault not found');
  }

  return vault;
}

/**
 * Update a vault.
 */
export async function update(
  userId: string,
  vaultId: string,
  data: { name?: string; description?: string | null },
): Promise<Vault> {
  // Verify ownership
  const existing = await getRow(userId, vaultId);

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
    // Note: we do NOT change the slug when the name changes.
    // This avoids breaking filesystem paths and document references.
  }

  if (data.description !== undefined) {
    updateData.description = data.description;
  }

  const [updated] = await db
    .update(vaults)
    .set(updateData)
    .where(eq(vaults.id, vaultId))
    .returning();

  return toPublicVault(updated);
}

/**
 * Get a vault by slug, verifying ownership.
 * Used by WebDAV to resolve vault from URL path.
 */
export async function getBySlug(
  userId: string,
  slug: string,
): Promise<typeof vaults.$inferSelect> {
  const [vault] = await db
    .select()
    .from(vaults)
    .where(and(eq(vaults.userId, userId), eq(vaults.slug, slug)))
    .limit(1);

  if (!vault) {
    throw new NotFoundError('Vault not found');
  }

  return vault;
}

/**
 * Delete a vault and its filesystem directory.
 */
export async function remove(userId: string, vaultId: string): Promise<void> {
  // Verify ownership and get vault details for filesystem cleanup
  const vault = await getRow(userId, vaultId);

  // Delete from DB (cascade deletes documents and versions)
  await db.delete(vaults).where(eq(vaults.id, vaultId));

  // Delete filesystem directory
  await filesystemService.deleteVaultDir(userId, vault.slug);
}
