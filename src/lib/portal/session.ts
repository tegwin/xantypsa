// ============================================================
// Portal sessions
// ============================================================
// Clients are Contacts, not Users, so they never touch Supabase Auth and can
// never reach the staff application. A portal session is a signed cookie
// naming one contact and one company, and every portal query is scoped to that
// company id — the client never supplies it.
//
// Signed with AI_ENCRYPTION_KEY, same as admin impersonation. Unsigned, the
// cookie would just be a company id anyone could edit to read another client's
// tickets.

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const PORTAL_COOKIE = 'vibepsa_portal';

/** Long enough to be useful, short enough that a shared laptop is not a breach. */
const TTL_SECONDS = 60 * 60 * 12;

export interface PortalPayload {
  contactId: string;
  companyId: string;
  tenantId: string;
  /** Set when a staff member is previewing the portal as this contact. */
  impersonatedBy?: string;
  exp: number;
}

function secret(): string {
  const raw = process.env.AI_ENCRYPTION_KEY;
  if (!raw) throw new Error('AI_ENCRYPTION_KEY must be set to use the client portal');
  return raw;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

export function encodeSession(payload: Omit<PortalPayload, 'exp'>, ttl = TTL_SECONDS): string {
  const body: PortalPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttl };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function decodeSession(raw?: string | null): PortalPayload | null {
  if (!raw) return null;

  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as PortalPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.contactId || !payload.companyId || !payload.tenantId) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setPortalCookie(payload: Omit<PortalPayload, 'exp'>) {
  cookies().set(PORTAL_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/portal',
    maxAge: TTL_SECONDS,
  });
}

export async function clearPortalCookie() {
  cookies().delete(PORTAL_COOKIE);
}

/**
 * The signed-in client, re-read from the database each time.
 *
 * The cookie proves who they are; it is never trusted for what they may see.
 * If portal access is withdrawn, or the contact is deactivated, the next
 * request fails even though the cookie is still valid.
 */
export async function getPortalSession() {
  const payload = decodeSession(cookies().get(PORTAL_COOKIE)?.value);
  if (!payload) return null;

  const contact = await prisma.contact.findFirst({
    where: {
      id: payload.contactId,
      companyId: payload.companyId,
      tenantId: payload.tenantId,
      isActive: true,
    },
    select: {
      id: true, firstName: true, lastName: true, email: true, portalEnabled: true,
      company: {
        select: { id: true, name: true, portalSlug: true, portalEnabled: true, tenantId: true },
      },
    },
  });

  if (!contact?.company?.portalEnabled) return null;
  // An impersonating staff member may preview a contact who is not themselves
  // enabled; a real client signing in must be.
  if (!contact.portalEnabled && !payload.impersonatedBy) return null;

  return {
    contact,
    company: contact.company,
    tenantId: payload.tenantId,
    impersonatedBy: payload.impersonatedBy ?? null,
  };
}

export type PortalSession = NonNullable<Awaited<ReturnType<typeof getPortalSession>>>;
