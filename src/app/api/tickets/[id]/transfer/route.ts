// ============================================================
// POST /api/tickets/<id>/transfer - move a ticket between queues
// ============================================================

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { dispatchWebhookEvent } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const parts = req.nextUrl.pathname.split('/');
  const ticketId = parts[parts.indexOf('tickets') + 1];
  const tenantId = session.user.tenantId;

  const body = await req.json().catch(() => ({}));
  const { queueId, note } = body;
  // Undefined means "leave the engineer alone"; null means "unassign".
  const assignedToId = body.assignedToId === undefined ? undefined : (body.assignedToId || null);

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
    select: {
      id: true, ticketNumber: true, queueId: true, assignedToId: true,
      queue: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });
  if (!ticket) return errorResponse('Ticket not found', 404);

  // A queue from another tenant must never be reachable by passing its id.
  let newQueueName = 'No queue';
  if (queueId) {
    const queue = await prisma.ticketQueue.findFirst({
      where: { id: String(queueId), tenantId },
      select: { id: true, name: true },
    });
    if (!queue) return errorResponse('Queue not found', 404);
    newQueueName = queue.name;
  }

  let newAgentName = 'Nobody';
  if (assignedToId) {
    const member = await prisma.tenantUser.findFirst({
      where: { tenantId, userId: String(assignedToId) },
      select: { user: { select: { name: true } } },
    });
    if (!member) return errorResponse('That person is not in this organisation', 400);
    newAgentName = member.user.name;
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      queueId: queueId ? String(queueId) : null,
      ...(assignedToId !== undefined ? { assignedToId } : {}),
    },
    select: {
      id: true, ticketNumber: true,
      queue: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  // Recorded on the ticket, because a transfer that leaves no trace is how a
  // ticket quietly becomes nobody's problem.
  const from = `${ticket.queue?.name ?? 'No queue'} / ${ticket.assignedTo?.name ?? 'Nobody'}`;
  const to = `${newQueueName} / ${assignedToId !== undefined ? newAgentName : (ticket.assignedTo?.name ?? 'Nobody')}`;
  const owner = await prisma.tenantUser.findFirst({
    where: { tenantId, isOwner: true },
    select: { userId: true },
  });

  await prisma.ticketNote.create({
    data: {
      ticketId: ticket.id,
      userId: session.user.id === 'api-key' ? (owner?.userId ?? '') : session.user.id,
      content: `Transferred from ${from} to ${to}.${note ? `\n\n${note}` : ''}`,
      isInternal: true,
    },
  });

  await dispatchWebhookEvent(tenantId, 'ticket.transferred', {
    id: updated.id,
    ticketNumber: updated.ticketNumber,
    queue: updated.queue,
    assignedTo: updated.assignedTo,
  }).catch(() => { /* a webhook must not fail the transfer */ });

  return jsonResponse(updated);
}, 'service_desk', 'write');
