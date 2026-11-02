import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { createLoginToken, sendLoginEmail, sendWelcomeEmail } from '@/lib/portal/magicLink';

function contactIdFrom(req: NextRequest) {
  const parts = req.nextUrl.pathname.split('/');
  return parts[parts.length - 2];
}

async function loadContact(id: string, tenantId: string) {
  return prisma.contact.findFirst({
    where: { id, tenantId },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      portalEnabled: true, portalLastLogin: true,
      company: { select: { id: true, name: true, portalEnabled: true, portalSlug: true } },
    },
  });
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const contact = await loadContact(contactIdFrom(req), session.user.tenantId);
  if (!contact) return errorResponse('Contact not found', 404);

  return jsonResponse({
    portalEnabled: contact.portalEnabled,
    portalLastLogin: contact.portalLastLogin,
    email: contact.email,
    // The portal is per company: a contact cannot sign in until their company
    // has one switched on.
    company: contact.company,
    // Sign-in is by emailed link. There is no password, so nothing to reset.
    loginMethod: 'magic_link',
  });
}, 'crm', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = contactIdFrom(req);
  const body = await req.json();

  const contact = await loadContact(id, session.user.tenantId);
  if (!contact) return errorResponse('Contact not found', 404);

  if (body.portalEnabled && !contact.email) {
    return errorResponse('This contact needs an email address before portal access can be given');
  }

  const updated = await prisma.contact.update({
    where: { id },
    data: { ...(body.portalEnabled !== undefined && { portalEnabled: !!body.portalEnabled }) },
    select: { portalEnabled: true },
  });

  return jsonResponse(updated);
}, 'crm', 'write');

/**
 * Email the contact: a welcome, or a fresh sign-in link.
 *
 * Both carry the same single-use link. The welcome one explains the portal, so
 * it reads right the first time somebody is given access.
 */
export const POST = withTenant(async (req: NextRequest, session: any) => {
  const id = contactIdFrom(req);
  const body = await req.json();
  const kind = body.kind === 'welcome' ? 'welcome' : 'login';

  const contact = await loadContact(id, session.user.tenantId);
  if (!contact) return errorResponse('Contact not found', 404);
  if (!contact.email) return errorResponse('This contact has no email address');
  if (!contact.portalEnabled) return errorResponse('Portal access is switched off for this contact');
  if (!contact.company?.portalEnabled || !contact.company.portalSlug) {
    return errorResponse(`The portal is not switched on for ${contact.company?.name || 'their company'}`);
  }

  const token = await createLoginToken(contact.id, req.headers.get('x-forwarded-for'));
  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const portalUrl = `${base}/portal/${contact.company.portalSlug}`;
  const link = `${portalUrl}/verify?token=${token}`;
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

  try {
    if (kind === 'welcome') {
      await sendWelcomeEmail(session.user.tenantId, contact.email, name, contact.company.name, link, portalUrl);
    } else {
      await sendLoginEmail(session.user.tenantId, contact.email, name, contact.company.name, link);
    }
  } catch (err: any) {
    return errorResponse(err.message || 'The email could not be sent', 502);
  }

  return jsonResponse({ sent: true, kind, to: contact.email });
}, 'crm', 'write');
