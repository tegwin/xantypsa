import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const reason = await prisma.winLossReason.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!reason) return errorResponse('Reason not found', 404);

  const updated = await prisma.winLossReason.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.isActive !== undefined && { isActive: !!body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: parseInt(body.sortOrder) || 0 }),
    },
  });
  return jsonResponse(updated);
}, 'crm', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const reason = await prisma.winLossReason.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!reason) return errorResponse('Reason not found', 404);

  // Closed opportunities cite the reason, so keep the record and hide it.
  const inUse = await prisma.opportunity.count({
    where: { tenantId: session.user.tenantId, reasonId: id },
  });
  if (inUse > 0) {
    await prisma.winLossReason.update({ where: { id }, data: { isActive: false } });
    return jsonResponse({
      deactivated: true,
      message: `${inUse} opportunit${inUse === 1 ? 'y uses' : 'ies use'} this reason, so it has been deactivated rather than deleted.`,
    });
  }

  await prisma.winLossReason.delete({ where: { id } });
  return jsonResponse({ deleted: true });
}, 'crm', 'write');
