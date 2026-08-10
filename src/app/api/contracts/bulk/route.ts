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
    // Get next contract number
    const lastContract = await prisma.contract.findFirst({
      where: { tenantId },
      orderBy: { contractNumber: 'desc' },
      select: { contractNumber: true },
    });
    let nextNum = 1;
    if (lastContract?.contractNumber) {
      const match = lastContract.contractNumber.match(/(\d+)$/);
      nextNum = match ? parseInt(match[1]) + 1 : 1;
    }

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.companyId || !item.name || !item.type || !item.startDate) {
          errors.push({ index: i, error: 'companyId, name, type, and startDate are required' });
          continue;
        }
        try {
          const contractNumber = `CON-${String(nextNum).padStart(4, '0')}`;
          nextNum++;

          await tx.contract.create({
            data: {
              tenantId,
              contractNumber,
              companyId: item.companyId,
              name: item.name,
              type: item.type,
              status: item.status || 'draft',
              startDate: new Date(item.startDate),
              endDate: item.endDate ? new Date(item.endDate) : null,
              fixedPrice: item.value ? parseFloat(item.value) : null,
              billingCycle: item.billingCycle || 'monthly',
              description: item.description || null,
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
