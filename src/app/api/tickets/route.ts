import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';
import { visibleTicketFilter } from '@/lib/queueAccess';
import { getNextNumber } from '@/lib/server-utils';
import { nextSequenceNumber } from '@/lib/references';
import { sendTicketNotification } from '@/lib/ticketEmail';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { title: { contains: p.search, mode: 'insensitive' } },
      { description: { contains: p.search, mode: 'insensitive' } },
    ];
    const num = parseInt(p.search);
    if (!isNaN(num)) where.OR.push({ ticketNumber: num });
  }
  if (p.status) where.status = p.status;
  if (p.type) where.type = p.type;
  if (p.companyId) where.companyId = p.companyId;
  if (p.opportunityId) where.opportunityId = p.opportunityId;
  if (p.assigneeId) where.assignedToId = p.assigneeId;
  // Filtering by queue, for the by-queue view.
  const queueId = new URL(req.url).searchParams.get('queueId');
  if (queueId) where.queueId = queueId === 'none' ? null : queueId;

  // Queue membership. Composed under AND because the search above already
  // uses OR, and a second OR at the top level would widen it instead of
  // narrowing it, showing people tickets they should not see.
  const visibility = await visibleTicketFilter(session);
  if (visibility) where.AND = [...(where.AND ?? []), visibility];

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        company: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { notes: true, timeEntries: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'service_desk', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.title) return errorResponse('Ticket title is required');

  const tenantId = session.user.tenantId;

  // Get next ticket number
  const lastTicket = await prisma.ticket.findFirst({
    where: { tenantId },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });
  // Carry on from the highest used, but never below the start the tenant set,
  // so an MSP can continue the numbering it had in its previous PSA.
  const tenantForNumbering = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const startAt = (tenantForNumbering?.settings as any)?.ticketStartNumber;
  const ticketNumber = nextSequenceNumber(lastTicket?.ticketNumber, startAt);

  const ticket = await prisma.ticket.create({
    data: {
      tenantId,
      ticketNumber,
      title: body.title,
      description: body.description || '',
      status: 'new',
      priority: body.priority || 'medium',
      type: body.type || 'incident',
      source: body.source || 'portal',
      category: body.category || null,
      companyId: body.companyId || null,
      opportunityId: body.opportunityId || null,
      contactId: body.contactId || null,
      assignedToId: body.assignedToId || null,
      contractId: body.contractId || null,
      createdById: session.user.id,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    },
    include: {
      company: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: session.user.id,
      action: 'created',
      entityType: 'ticket',
      entityId: ticket.id,
      changes: { ticketNumber, title: ticket.title },
    },
  });

  // Fire and forget email notification
  sendTicketNotification(tenantId, ticket.id, 'ticket_created');

  return jsonResponse(ticket, 201);
}, 'service_desk', 'write');
