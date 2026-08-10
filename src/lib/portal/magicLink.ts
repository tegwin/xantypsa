// ============================================================
// Magic-link sign-in
// ============================================================
// Clients get a one-time link by email rather than a password. No password
// store to defend, nothing for a client to forget, and receiving the link
// proves they still control the mailbox we hold for them.

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSmtpConfig, sendEmail } from '@/lib/email';

/** Short — a sign-in link sitting in an inbox for a week is a liability. */
const TTL_MINUTES = 20;

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a link for a contact. Returns the raw token, which is never stored.
 */
export async function createLoginToken(contactId: string, requestIp?: string | null) {
  // Retire anything outstanding, so a forwarded older email stops working the
  // moment a new one is requested.
  await prisma.portalLoginToken.deleteMany({
    where: { contactId, usedAt: null },
  });

  const token = crypto.randomBytes(32).toString('base64url');

  await prisma.portalLoginToken.create({
    data: {
      contactId,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
      requestIp: requestIp ?? null,
    },
  });

  return token;
}

/**
 * Exchange a token for the contact it belongs to, consuming it.
 *
 * Single use: the row is marked used inside the same query that claims it, so
 * two simultaneous requests cannot both succeed.
 */
export async function consumeLoginToken(token: string) {
  const record = await prisma.portalLoginToken.findUnique({
    where: { tokenHash: hash(token) },
    include: {
      contact: {
        select: {
          id: true, tenantId: true, companyId: true, portalEnabled: true, isActive: true,
        },
      },
    },
  });

  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;
  if (!record.contact?.isActive || !record.contact.portalEnabled) return null;
  if (!record.contact.companyId) return null;

  // Claim it. count === 0 means another request got there first.
  const claimed = await prisma.portalLoginToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  await prisma.contact.update({
    where: { id: record.contact.id },
    data: { portalLastLogin: new Date() },
  });

  return record.contact;
}

export async function sendLoginEmail(
  tenantId: string,
  toEmail: string,
  contactName: string,
  companyName: string,
  link: string
) {
  const config = await getSmtpConfig(tenantId);
  if (!config) throw new Error('No outbound email is configured, so sign-in links cannot be sent.');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <p>Hello ${contactName},</p>
      <p>Here is your sign-in link for the ${companyName} support portal.</p>
      <p style="margin: 28px 0;">
        <a href="${link}" style="background:#1e6af5;color:#fff;padding:12px 24px;
           text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
          Sign in
        </a>
      </p>
      <p style="color:#666;font-size:13px;">
        This link works once and expires in ${TTL_MINUTES} minutes.
        If you did not ask for it, you can ignore this email — nobody can sign in without it.
      </p>
    </div>
  `;

  await sendEmail(config, toEmail, `Sign in to the ${companyName} portal`, html);
}

export { TTL_MINUTES as LOGIN_LINK_TTL_MINUTES };
