// ============================================================
// Raise a ticket from the portal
// ============================================================
// The company, tenant and contact all come from the signed session cookie.
// Nothing the client sends can change who the ticket belongs to.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';
import { assignReference } from '@/lib/numbering';

export const dynamic = 'force-dynamic';

const PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);

export async function POST(req: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? '').trim().slice(0, 200);
  const description = String(body.description ?? '').trim().slice(0, 20000);

  if (!title || !description) {
    return NextResponse.json({ error: 'A title and description are required.' }, { status: 400 });
  }

  // Priority is a client's opinion, so keep it to known values - but let the
  // MSP re-triage. It is a request, not an instruction.
  const priority = PRIORITIES.has(body.priority) ? body.priority : 'medium';

  // Typed narrowly: spreading a Record<string, any> into Prisma's create data
  // collapses its discriminated union and the whole call stops type-checking.
  const { ticketNumber } = (await assignReference('Ticket', session.tenantId, {})) as {
    ticketNumber: number;
  };
  const owner = await prisma.tenantUser.findFirst({
    where: { tenantId: session.tenantId, isOwner: true },
    select: { userId: true },
  });

  const ticket = await prisma.ticket.create({
    data: {
      tenantId: session.tenantId,
      companyId: session.company.id,
      contactId: session.contact.id,
      ticketNumber,
      title,
      description,
      status: 'new',
      priority,
      type: 'incident',
      source: 'portal',
      createdById: owner?.userId ?? '',
    },
    select: { id: true, ticketNumber: true },
  });

  return NextResponse.json({ ok: true, ...ticket }, { status: 201 });
}
