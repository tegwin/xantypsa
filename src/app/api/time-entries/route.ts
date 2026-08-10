import { NextRequest } from 'next/server';
import { calculateInternalCost } from '@/lib/costing';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.userId) where.userId = p.userId;
  if (p.ticketId) where.ticketId = p.ticketId;
  if (p.projectId) where.projectId = p.projectId;
  if (p.dateFrom || p.dateTo) {
    where.date = {};
    if (p.dateFrom) where.date.gte = new Date(p.dateFrom);
    if (p.dateTo) where.date.lte = new Date(p.dateTo);
  }

  const [items, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { date: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        ticket: { select: { id: true, ticketNumber: true, title: true, company: { select: { name: true } } } },
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        billingRate: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.timeEntry.count({ where }),
  ]);

  // Calculate totals
  const totals = await prisma.timeEntry.aggregate({
    where,
    _sum: { hours: true, minutes: true },
  });

  return jsonResponse({
    items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit),
    totalHours: (totals._sum.hours || 0) + (totals._sum.minutes || 0) / 60,
  });
}, 'service_desk', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const tenantId = session.user.tenantId;

  const hours = parseFloat(body.hours) || 0;
  const minutes = parseInt(body.minutes) || 0;

  // Snapshot what this work cost us at the moment it was logged. Recomputing
  // later would let a pay rise silently rewrite historical profitability.
  const entryUserId = body.userId || session.user.id;
  const internalCost = await calculateInternalCost(entryUserId, tenantId, hours, body.billingRateId);

  const entry = await prisma.timeEntry.create({
    data: {
      tenantId,
      userId: entryUserId,
      ticketId: body.ticketId || null,
      projectId: body.projectId || null,
      taskId: body.taskId || null,
      description: body.description || null,
      date: body.date ? new Date(body.date) : new Date(),
      hours,
      minutes,
      billable: body.billable ?? true,
      rate: body.rate ? parseFloat(body.rate) : null,
      internalCost,
      startTime: body.startTime ? new Date(body.startTime) : null,
      endTime: body.endTime ? new Date(body.endTime) : null,
    },
    include: {
      user: { select: { name: true } },
      ticket: { select: { ticketNumber: true, title: true } },
    },
  });

  // Update related ticket/project time
  const totalMinutes = Math.round(hours * 60 + minutes);
  if (body.ticketId) {
    await prisma.ticket.update({
      where: { id: body.ticketId },
      data: { timeSpent: { increment: totalMinutes } },
    });
  }

  return jsonResponse(entry, 201);
}, 'service_desk', 'write');
