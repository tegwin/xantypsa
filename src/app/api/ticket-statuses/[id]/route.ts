import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const status = await prisma.ticketStatus.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!status) return errorResponse('Status not found', 404);

  const updated = await prisma.ticketStatus.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.isClosed !== undefined && { isClosed: body.isClosed }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });

  if (updated.isDefault) {
    await prisma.ticketStatus.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const status = await prisma.ticketStatus.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!status) return errorResponse('Status not found', 404);
  if (status.isSystem) return errorResponse('Cannot delete system statuses', 400);

  // Check if any tickets use this status
  const inUse = await prisma.ticket.count({ where: { status: status.slug, tenantId: session.user.tenantId } });
  if (inUse > 0) return errorResponse(`Cannot delete: ${inUse} tickets use this status. Change them first.`, 400);

  await prisma.ticketStatus.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'settings', 'write');
