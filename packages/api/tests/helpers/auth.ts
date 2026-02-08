import { getDb } from './db.js';
import { users, invitations } from '../../src/db/schema.js';
import { hashPassword, generateToken } from '../../src/utils/crypto.js';
import { signAccessToken } from '../../src/utils/jwt.js';

/**
 * Create a test user directly in the database.
 */
export async function createTestUser(overrides?: {
  email?: string;
  password?: string;
  displayName?: string;
  role?: 'admin' | 'user';
  isActive?: boolean;
}) {
  const db = getDb();

  const email = overrides?.email || `test-${Date.now()}@example.com`;
  const password = overrides?.password || 'TestPassword123!';
  const displayName = overrides?.displayName || 'Test User';
  const role = overrides?.role || 'user';
  const isActive = overrides?.isActive ?? true;

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      displayName,
      role,
      isActive,
    })
    .returning();

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    rawPassword: password,
  };
}

/**
 * Create a test admin user.
 */
export async function createTestAdmin() {
  return createTestUser({
    email: `admin-${Date.now()}@example.com`,
    displayName: 'Test Admin',
    role: 'admin',
  });
}

/**
 * Generate a JWT access token for a user.
 */
export async function getAuthToken(userId: string, email: string, role: string) {
  return signAccessToken({ userId, email, role });
}

/**
 * Create an invitation in the database.
 */
export async function createInvitation(email: string, invitedBy: string) {
  const db = getDb();

  const token = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  const [invitation] = await db
    .insert(invitations)
    .values({
      email: email.toLowerCase(),
      invitedBy,
      token,
      expiresAt,
    })
    .returning();

  return {
    id: invitation.id,
    email: invitation.email,
    invitedBy: invitation.invitedBy,
    token: invitation.token,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() || null,
    createdAt: invitation.createdAt.toISOString(),
  };
}
