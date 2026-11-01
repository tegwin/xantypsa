import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const rates = await prisma.billingRate.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return jsonResponse({ items: rates });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Rate name is required');
  const isNonBillable = !!body.isNonBillable;
  // A non-billable rate has no price by definition, so the rate is not asked
  // for and anything sent is ignored.
  if (!isNonBillable && (body.rate === undefined || body.rate === null)) {
    return errorResponse('Hourly rate is required');
  }

  const rate = await prisma.billingRate.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      code: body.code || null,
      isNonBillable,
      rate: isNonBillable ? 0 : parseFloat(body.rate),
      costRate: isNonBillable ? 0 : parseFloat(body.costRate || '0'),
      // No charge means no minimum and no rounding: record the time as worked.
      minimumMinutes: isNonBillable ? 0 : parseInt(body.minimumMinutes || '15'),
      roundingMinutes: isNonBillable ? 0 : parseInt(body.roundingMinutes || '15'),
      oohMultiplier: isNonBillable ? 1.0 : parseFloat(body.oohMultiplier || '1.0'),
      // Never the default: that would make every new time entry free.
      isDefault: isNonBillable ? false : (body.isDefault || false),
      sortOrder: body.sortOrder || 0,
    },
  });

  // If this is set as default, unset others
  if (rate.isDefault) {
    await prisma.billingRate.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: rate.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(rate, 201);
}, 'settings', 'write');
