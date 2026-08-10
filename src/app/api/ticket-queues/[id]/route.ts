import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const queue = await prisma.ticketQueue.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!queue) return errorResponse('Queue not found', 404);

  const updated = await prisma.ticketQueue.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  if (updated.isDefault) {
    await prisma.ticketQueue.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const queue = await prisma.ticketQueue.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!queue) return errorResponse('Queue not found', 404);

  const inUse = await prisma.ticket.count({ where: { queueId: id } });
  if (inUse > 0) return errorResponse(`Cannot delete: ${inUse} tickets in this queue. Move them first.`, 400);

  await prisma.ticketQueue.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'settings', 'write');
