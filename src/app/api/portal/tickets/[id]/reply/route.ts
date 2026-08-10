// ============================================================
// Client reply on a ticket
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const parts = req.nextUrl.pathname.split('/');
  const ticketId = parts[parts.indexOf('tickets') + 1];

  const { content } = await req.json().catch(() => ({ content: '' }));
  const text = String(content ?? '').trim().slice(0, 20000);
  if (!text) return NextResponse.json({ error: 'Write something first.' }, { status: 400 });

  // Scoped to the session's company: a ticket id from elsewhere simply is not
  // found, rather than being edited.
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: session.tenantId, companyId: session.company.id },
    select: { id: true, status: true },
  });
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  if (['resolved', 'closed'].includes(ticket.status)) {
    return NextResponse.json(
      { error: 'This ticket is closed. Please raise a new one.' },
      { status: 400 }
    );
  }

  const owner = await prisma.tenantUser.findFirst({
    where: { tenantId: session.tenantId, isOwner: true },
    select: { userId: true },
  });

  await prisma.ticketNote.create({
    data: {
      ticketId: ticket.id,
      // TicketNote.userId expects a staff user, and the client is a Contact.
      // Attribute to the tenant owner and name the client in the note, so the
      // note is never silently mistaken for something a technician wrote.
      userId: owner?.userId ?? '',
      content: `${session.contact.firstName} ${session.contact.lastName} (client) wrote:\n\n${text}`,
      isInternal: false,
    },
  });

  // A client replying means the ball is back with the MSP.
  if (ticket.status === 'waiting') {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'open' } });
  }

  return NextResponse.json({ ok: true });
}
