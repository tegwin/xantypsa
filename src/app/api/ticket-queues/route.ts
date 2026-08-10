import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const queues = await prisma.ticketQueue.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { tickets: true } } },
  });
  return jsonResponse({ items: queues });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Queue name is required');

  const queue = await prisma.ticketQueue.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      description: body.description || null,
      isDefault: body.isDefault ?? false,
      sortOrder: body.sortOrder ?? 99,
    },
  });

  if (queue.isDefault) {
    await prisma.ticketQueue.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: queue.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(queue, 201);
}, 'settings', 'write');
