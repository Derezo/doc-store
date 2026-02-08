import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { logger as rootLogger } from '../utils/logger.js';

const logger = rootLogger.child({ module: 'email-service' });

/**
 * Send an invitation email to a new user.
 * If SMTP is not configured, logs the invitation URL instead (dev mode).
 */
export async function sendInvitationEmail(
  to: string,
  inviterName: string,
  token: string,
): Promise<void> {
  const inviteUrl = `${config.WEB_URL}/register?token=${token}`;

  // If SMTP is not configured, log the invitation URL (dev mode)
  if (!config.SMTP_HOST) {
    logger.info(
      { to, inviteUrl },
      'SMTP not configured -- invitation URL (copy this for manual use)',
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT ?? 587,
    secure: (config.SMTP_PORT ?? 587) === 465,
    auth:
      config.SMTP_USER && config.SMTP_PASS
        ? {
            user: config.SMTP_USER,
            pass: config.SMTP_PASS,
          }
        : undefined,
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #111; margin-bottom: 16px;">You've been invited to doc-store</h2>
  <p style="font-size: 16px; line-height: 1.5;">
    <strong>${escapeHtml(inviterName)}</strong> has invited you to join doc-store, a personal document management system.
  </p>
  <p style="font-size: 16px; line-height: 1.5;">
    Click the button below to create your account. This invitation expires in 7 days.
  </p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="${escapeHtml(inviteUrl)}"
       style="display: inline-block; background-color: #111; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-size: 16px; font-weight: 500;">
      Create Account
    </a>
  </div>
  <p style="font-size: 14px; color: #666; line-height: 1.5;">
    Or copy and paste this URL into your browser:<br>
    <a href="${escapeHtml(inviteUrl)}" style="color: #2563eb; word-break: break-all;">${escapeHtml(inviteUrl)}</a>
  </p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;">
  <p style="font-size: 12px; color: #999;">
    If you did not expect this invitation, you can safely ignore this email.
  </p>
</body>
</html>
  `.trim();

  try {
    await transporter.sendMail({
      from: config.SMTP_FROM ?? config.SMTP_USER ?? 'noreply@doc-store.local',
      to,
      subject: "You've been invited to doc-store",
      html,
    });
    logger.info({ to }, 'Invitation email sent');
  } catch (err) {
    logger.error({ err, to }, 'Failed to send invitation email');
    throw err;
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
