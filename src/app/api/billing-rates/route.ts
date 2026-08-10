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
  if (body.rate === undefined || body.rate === null) return errorResponse('Hourly rate is required');

  const rate = await prisma.billingRate.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      code: body.code || null,
      rate: parseFloat(body.rate),
      costRate: parseFloat(body.costRate || '0'),
      minimumMinutes: parseInt(body.minimumMinutes || '15'),
      roundingMinutes: parseInt(body.roundingMinutes || '15'),
      oohMultiplier: parseFloat(body.oohMultiplier || '1.0'),
      isDefault: body.isDefault || false,
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
