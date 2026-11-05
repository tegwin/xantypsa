import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isClosedStatus } from '@/lib/ticketStatus';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { visibleTicketFilter } from '@/lib/queueAccess';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  // The same queue rules as the list. Without this, a ticket hidden from the
  // list would still open for anybody who knew or guessed its URL.
  const visibility = await visibleTicketFilter(session);
  const ticket = await prisma.ticket.findFirst({
    where: { id, tenantId: session.user.tenantId, ...(visibility ?? {}) },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      queue: { select: { id: true, name: true } },
      contract: { select: {
        id: true, name: true, contractNumber: true, type: true,
        totalHours: true, hoursUsed: true, monthlyFee: true, fixedPrice: true, value: true,
        blockMode: true, hoursPerPeriod: true, overhourRate: true, alertThreshold: true,
      } },
      notes: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      },
      timeEntries: {
        orderBy: { date: 'desc' },
        include: {
          user: { select: { id: true, name: true } },
          billingRate: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
  if (!ticket) return errorResponse('Ticket not found', 404);
  return jsonResponse(ticket);
}, 'service_desk', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();
  const tenantId = session.user.tenantId;

  const ticket = await prisma.ticket.findFirst({ where: { id, tenantId } });
  if (!ticket) return errorResponse('Ticket not found', 404);

  const data: any = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.type !== undefined) data.type = body.type;
  if (body.category !== undefined) data.category = body.category;
  if (body.companyId !== undefined) data.companyId = body.companyId || null;
  if (body.contactId !== undefined) data.contactId = body.contactId || null;
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId || null;
  if (body.contractId !== undefined) data.contractId = body.contractId || null;
  // Moving a queue is the same change the Transfer dialog makes; it just no
  // longer requires opening it.
  if (body.queueId !== undefined) data.queueId = body.queueId || null;
  if (body.opportunityId !== undefined) data.opportunityId = body.opportunityId || null;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  if (body.status !== undefined && body.status !== ticket.status) {
    data.status = body.status;
    // Any status flagged as closed closes the ticket, whatever it is called.
    if (body.status === 'resolved') data.resolvedAt = new Date();
    if (await isClosedStatus(tenantId, body.status)) data.closedAt = new Date();
    if (!ticket.firstResponse && ['open', 'pending'].includes(body.status)) {
      data.firstResponse = new Date();
    }

    // Create system note for status change
    await prisma.ticketNote.create({
      data: {
        ticketId: id,
        userId: session.user.id,
        content: `Status changed from ${ticket.status} to ${body.status}`,
        isInternal: true,
      },
    });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data,
    include: {
      company: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  return jsonResponse(updated);
}, 'service_desk', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const ticket = await prisma.ticket.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!ticket) return errorResponse('Ticket not found', 404);

  await prisma.ticket.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'service_desk', 'write');
