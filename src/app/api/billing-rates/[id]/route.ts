import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const rate = await prisma.billingRate.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!rate) return errorResponse('Billing rate not found', 404);

  // Whichever way the flag ends up, a non-billable rate is forced to zero so a
  // stale price can never be charged.
  const nextNonBillable = body.isNonBillable !== undefined ? !!body.isNonBillable : rate.isNonBillable;

  const updated = await prisma.billingRate.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.code !== undefined && { code: body.code }),
      ...(body.isNonBillable !== undefined && { isNonBillable: nextNonBillable }),
      ...(nextNonBillable
        ? { rate: 0, costRate: 0 }
        : {
            ...(body.rate !== undefined && { rate: parseFloat(body.rate) }),
            ...(body.costRate !== undefined && { costRate: parseFloat(body.costRate) }),
          }),
      ...(body.minimumMinutes !== undefined && { minimumMinutes: parseInt(body.minimumMinutes) }),
      ...(body.roundingMinutes !== undefined && { roundingMinutes: parseInt(body.roundingMinutes) }),
      ...(body.oohMultiplier !== undefined && { oohMultiplier: parseFloat(body.oohMultiplier) }),
      ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  if (updated.isDefault) {
    await prisma.billingRate.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const rate = await prisma.billingRate.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!rate) return errorResponse('Billing rate not found', 404);

  // Check if in use
  const inUse = await prisma.timeEntry.count({ where: { billingRateId: id } });
  if (inUse > 0) {
    // Soft delete
    await prisma.billingRate.update({ where: { id }, data: { isActive: false } });
    return jsonResponse({ success: true, softDeleted: true });
  }

  await prisma.billingRate.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'settings', 'write');
