import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const body = await req.json();
  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse('items array is required');
  }

  if (items.length > 100) {
    return errorResponse('Maximum 100 items per request');
  }

  const errors: any[] = [];
  let created = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.name) {
          errors.push({ index: i, error: 'name is required' });
          continue;
        }
        try {
          await tx.product.create({
            data: {
              tenantId,
              name: item.name,
              description: item.description || null,
              sku: item.sku || null,
              category: item.category || null,
              type: item.type || 'service',
              unitPrice: item.unitPrice ? parseFloat(item.unitPrice) : 0,
              cost: item.cost ? parseFloat(item.cost) : 0,
              taxRate: item.taxRate !== undefined ? parseFloat(item.taxRate) : 20,
              unit: item.unit || 'each',
              billingType: item.billingType || 'one_off',
              billingPeriod: item.billingPeriod || null,
              isRecurring: item.billingType === 'recurring',
              isService: item.type === 'service',
            },
          });
          created++;
        } catch (err: any) {
          errors.push({ index: i, error: err.message });
        }
      }
    });
  } catch (err: any) {
    return errorResponse(`Transaction failed: ${err.message}`, 500);
  }

  return jsonResponse({ created, errors }, errors.length > 0 ? 207 : 201);
});
