import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { invitations, users } from '../db/schema.js';
import { generateToken } from '../utils/crypto.js';
import { NotFoundError, ConflictError, AuthorizationError } from '../utils/errors.js';
import { sendInvitationEmail } from './email.service.js';
import { logger as rootLogger } from '../utils/logger.js';

const logger = rootLogger.child({ module: 'invitation-service' });

const INVITATION_EXPIRY_DAYS = 7;
const INVITATION_TOKEN_BYTES = 32; // produces 64 hex chars

export interface InvitationWithInviter {
  id: string;
  email: string;
  invitedBy: string;
  inviterName: string;
  inviterEmail: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

/**
 * Create an invitation and send the invitation email.
 * Only admins can create invitations.
 */
export async function create(
  adminUserId: string,
  email: string,
): Promise<InvitationWithInviter> {
  // Verify caller is admin
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.id, adminUserId))
    .limit(1);

  if (!admin || admin.role !== 'admin') {
    throw new AuthorizationError('Admin access required');
  }

  // Check if user already exists with this email
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingUser) {
    throw new ConflictError('A user with this email already exists');
  }

  // Check for existing pending invitation
  const [existingInvite] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.email, email.toLowerCase()),
        isNull(invitations.acceptedAt),
      ),
    )
    .limit(1);

  if (existingInvite && existingInvite.expiresAt > new Date()) {
    throw new ConflictError('A pending invitation already exists for this email');
  }

  // Generate token and expiry
  const token = generateToken(INVITATION_TOKEN_BYTES);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  // Insert invitation
  const [invitation] = await db
    .insert(invitations)
    .values({
      email: email.toLowerCase(),
      invitedBy: adminUserId,
      token,
      expiresAt,
    })
    .returning();

  // Send email (fire-and-forget error handling -- invitation is created regardless)
  try {
    await sendInvitationEmail(email, admin.displayName, token);
  } catch (err) {
    logger.error({ err, email }, 'Failed to send invitation email, but invitation was created');
  }

  return toInvitationWithInviter(invitation, admin);
}

/**
 * List all invitations with inviter info.
 */
export async function list(): Promise<InvitationWithInviter[]> {
  const rows = await db
    .select({
      invitation: invitations,
      inviterName: users.displayName,
      inviterEmail: users.email,
    })
    .from(invitations)
    .innerJoin(users, eq(invitations.invitedBy, users.id))
    .orderBy(desc(invitations.createdAt));

  return rows.map((row) =>
    toInvitationWithInviter(row.invitation, {
      displayName: row.inviterName,
      email: row.inviterEmail,
    }),
  );
}

/**
 * Revoke (delete) an invitation.
 */
export async function revoke(
  adminUserId: string,
  invitationId: string,
): Promise<void> {
  // Verify caller is admin
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.id, adminUserId))
    .limit(1);

  if (!admin || admin.role !== 'admin') {
    throw new AuthorizationError('Admin access required');
  }

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);

  if (!invitation) {
    throw new NotFoundError('Invitation not found');
  }

  await db.delete(invitations).where(eq(invitations.id, invitationId));
}

/**
 * Convert a DB invitation row + inviter info to the API response shape.
 */
function toInvitationWithInviter(
  invitation: typeof invitations.$inferSelect,
  inviter: { displayName: string; email: string },
): InvitationWithInviter {
  const now = new Date();
  let status: 'pending' | 'accepted' | 'expired';

  if (invitation.acceptedAt) {
    status = 'accepted';
  } else if (invitation.expiresAt < now) {
    status = 'expired';
  } else {
    status = 'pending';
  }

  return {
    id: invitation.id,
    email: invitation.email,
    invitedBy: invitation.invitedBy,
    inviterName: inviter.displayName,
    inviterEmail: inviter.email,
    token: invitation.token,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
    status,
  };
}
