import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, invitations, sessions } from '../db/schema.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  hashToken,
} from '../utils/crypto.js';
import { signAccessToken } from '../utils/jwt.js';
import {
  AuthenticationError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
} from '../utils/errors.js';
import type { User } from '@doc-store/shared';

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const MAX_FAILED_LOGIN_ATTEMPTS = 10;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Convert a DB user row to a public User object.
 */
function toPublicUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role as 'admin' | 'user',
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Create a session and issue a JWT pair (access token + refresh token).
 */
async function createSession(
  userId: string,
  email: string,
  role: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken({ userId, email, role });
  const refreshToken = generateToken(64);
  const refreshTokenHashed = hashToken(refreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.insert(sessions).values({
    userId,
    refreshTokenHash: refreshTokenHashed,
    userAgent: userAgent ?? null,
    ipAddress: ipAddress ?? null,
    expiresAt,
  });

  return { accessToken, refreshToken };
}

/**
 * Register a new user via invitation token.
 */
export async function register(
  email: string,
  password: string,
  displayName: string,
  inviteToken: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  // Hash password before transaction (argon2 is slow, don't hold a transaction open)
  const passwordHashed = await hashPassword(password);

  // Wrap in a transaction to prevent TOCTOU race conditions
  const newUser = await db.transaction(async (tx) => {
    // 1. Lock and validate invitation (SELECT ... FOR UPDATE)
    const [invitation] = await tx
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.token, inviteToken),
          isNull(invitations.acceptedAt),
        ),
      )
      .for('update')
      .limit(1);

    if (!invitation) {
      throw new NotFoundError('Invalid or already used invitation token');
    }

    if (invitation.expiresAt < new Date()) {
      throw new ValidationError('Invitation token has expired');
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw new ValidationError(
        'Email does not match the invitation',
      );
    }

    // 2. Check for existing user with this email
    const [existingUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    // 3. Create user
    const [user] = await tx
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash: passwordHashed,
        displayName,
        role: 'user',
      })
      .returning();

    // 4. Mark invitation as accepted
    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    return user;
  });

  // 5. Create session (outside transaction — not critical for atomicity)
  const { accessToken, refreshToken } = await createSession(
    newUser.id,
    newUser.email,
    newUser.role,
    meta?.userAgent,
    meta?.ipAddress,
  );

  return {
    user: toPublicUser(newUser),
    accessToken,
    refreshToken,
  };
}

/**
 * Login with email and password.
 */
export async function login(
  email: string,
  password: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  // 1. Find user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    throw new AuthenticationError('Invalid email or password');
  }

  if (!user.isActive) {
    throw new AuthenticationError('Account is disabled');
  }

  // 2. Check brute force lockout
  if (
    user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS &&
    user.lastFailedLoginAt &&
    Date.now() - user.lastFailedLoginAt.getTime() < FAILED_LOGIN_WINDOW_MS
  ) {
    throw new RateLimitError('Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.');
  }

  // 3. Verify password
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    // Track failed attempt
    const now = new Date();
    const withinWindow =
      user.lastFailedLoginAt &&
      now.getTime() - user.lastFailedLoginAt.getTime() < FAILED_LOGIN_WINDOW_MS;

    await db
      .update(users)
      .set({
        failedLoginAttempts: withinWindow ? user.failedLoginAttempts + 1 : 1,
        lastFailedLoginAt: now,
      })
      .where(eq(users.id, user.id));

    throw new AuthenticationError('Invalid email or password');
  }

  // 4. Reset failed login attempts on success
  if (user.failedLoginAttempts > 0) {
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lastFailedLoginAt: null })
      .where(eq(users.id, user.id));
  }

  // 5. Create session
  const { accessToken, refreshToken } = await createSession(
    user.id,
    user.email,
    user.role,
    meta?.userAgent,
    meta?.ipAddress,
  );

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh tokens by rotating the refresh token.
 */
export async function refresh(
  currentRefreshToken: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<{ user: User; accessToken: string; refreshToken: string }> {
  const tokenHash = hashToken(currentRefreshToken);

  // 1. Find session with matching refresh token hash
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, tokenHash))
    .limit(1);

  if (!session) {
    throw new AuthenticationError('Invalid refresh token');
  }

  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await db.delete(sessions).where(eq(sessions.id, session.id));
    throw new AuthenticationError('Refresh token has expired');
  }

  // 2. Fetch user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!user || !user.isActive) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    throw new AuthenticationError('User not found or disabled');
  }

  // 3. Rotate: delete old session, create new one
  await db.delete(sessions).where(eq(sessions.id, session.id));

  const { accessToken, refreshToken: newRefreshToken } = await createSession(
    user.id,
    user.email,
    user.role,
    meta?.userAgent,
    meta?.ipAddress,
  );

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout by deleting the session.
 */
export async function logout(userId: string, refreshToken?: string): Promise<void> {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          eq(sessions.refreshTokenHash, tokenHash),
        ),
      );
  } else {
    // If no refresh token provided, delete all sessions for this user
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

/**
 * Get a user by ID.
 */
export async function getUserById(userId: string): Promise<User> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return toPublicUser(user);
}
