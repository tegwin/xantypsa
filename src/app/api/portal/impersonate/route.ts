// ============================================================
// View the portal as a contact
// ============================================================
// Staff-only. Mints a portal session for a contact so support can see exactly
// what the client sees — the usual "it looks wrong on my end" call.
//
// Note this is NOT wrapped in withTenant's portal session: it is authenticated
// as a *staff* user, and it writes an audit record before granting anything.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAppSession } from '@/lib/session';
import { encodeSession, PORTAL_COOKIE } from '@/lib/portal/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Previewing a client portal exposes that client's tickets and invoices, so
  // it needs the same standing as managing them.
  const permitted =
    session.user.isSuperAdmin ||
    session.user.permissions?.includes('crm:manage') ||
    session.user.permissions?.includes('settings:manage');
  if (!permitted) {
    return NextResponse.json({ error: 'You do not have permission to preview portals.' }, { status: 403 });
  }

  // An already-impersonated admin must not chain into a portal preview — the
  // audit trail would name the wrong person.
  if (session.impersonatedBy) {
    return NextResponse.json(
      { error: 'Stop impersonating a user before previewing a portal.' },
      { status: 400 }
    );
  }

  const { contactId } = await req.json().catch(() => ({ contactId: null }));
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

  const res = NextResponse.json({
    ok: true,
    url: `/portal/${contact.company.portalSlug}/tickets`,
  });

  res.cookies.set(
    PORTAL_COOKIE,
    encodeSession(
      {
        contactId: contact.id,
        companyId: contact.company.id,
        tenantId: session.user.tenantId,
        impersonatedBy: session.user.id,
      },
      // Short: this is a support glance, not a session.
      60 * 30
    ),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/portal',
      maxAge: 60 * 30,
    }
  );

  return res;
}
