// ============================================================
// View the portal as a contact
// ============================================================
// Staff-only. Mints a portal session for a contact so support can see exactly
// what the client sees - the usual "it looks wrong on my end" call.
//
// Note this is NOT wrapped in withTenant's portal session: it is authenticated
// as a *staff* user, and it writes an audit record before granting anything.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAppSession } from '@/lib/session';
import { encodeSession, PORTAL_COOKIE } from '@/lib/portal/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Administrators only. Previewing a portal signs you in as somebody else and
  // exposes everything they can see, so it sits with managing settings rather
  // than with managing customers. Manager and below are deliberately excluded.
  const permitted =
    session.user.isSuperAdmin ||
    session.user.permissions?.includes('settings:manage');
  if (!permitted) {
    return NextResponse.json({ error: 'You do not have permission to preview portals.' }, { status: 403 });
  }

  // An already-impersonated admin must not chain into a portal preview - the
  // audit trail would name the wrong person.
  if (session.impersonatedBy) {
    return NextResponse.json(
      { error: 'Stop impersonating a user before previewing a portal.' },
      { status: 400 }
    );
  }

  // A GET carries it in the query, a POST in the body.
  const contactId =
    req.nextUrl.searchParams.get('contactId') ||
    (await req.json().catch(() => ({ contactId: null }))).contactId;
  if (!contactId) return NextResponse.json({ error: 'contactId is required' }, { status: 400 });

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId: session.user.tenantId },
    select: {
      id: true, firstName: true, lastName: true, companyId: true,
      company: { select: { id: true, name: true, portalSlug: true, portalEnabled: true } },
    },
  });

  if (!contact?.company) {
    return NextResponse.json({ error: 'That contact has no company.' }, { status: 404 });
  }
  if (!contact.company.portalEnabled || !contact.company.portalSlug) {
    return NextResponse.json(
      { error: `The portal is not switched on for ${contact.company.name}.` },
      { status: 400 }
    );
  }

  await prisma.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: 'portal.impersonate',
      entityType: 'contact',
      entityId: contact.id,
      changes: {
        contact: `${contact.firstName} ${contact.lastName}`,
        company: contact.company.name,
      },
    },
  });

  const target = `/portal/${contact.company.portalSlug}/home`;

  // A redirect rather than JSON, so the browser lands on the portal with the
  // cookie already applied. Opening a window after an async fetch is both
  // popup-blocked and a race against the cookie being stored.
  const wantsRedirect = req.nextUrl.searchParams.get('redirect') === '1';
  const res = wantsRedirect
    ? NextResponse.redirect(new URL(target, req.nextUrl.origin))
    : NextResponse.json({ ok: true, url: target });

  res.cookies.set(
    PORTAL_COOKIE,
    encodeSession(
      {
        contactId: contact.id,
        companyId: contact.company.id,
        tenantId: session.user.tenantId,
        impersonatedBy: session.user.id,
      },
      // Long enough to work through a problem without being thrown out
      // mid-task, short enough that a forgotten tab is not a standing door.
      60 * 120
    ),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 120,
    }
  );

  return res;
}
