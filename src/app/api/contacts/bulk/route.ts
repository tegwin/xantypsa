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
        if (!item.firstName || !item.lastName) {
          errors.push({ index: i, error: 'firstName and lastName are required' });
          continue;
        }
        try {
          await tx.contact.create({
            data: {
              tenantId,
              firstName: item.firstName,
              lastName: item.lastName,
              email: item.email || null,
              phone: item.phone || null,
              mobile: item.mobile || null,
              jobTitle: item.jobTitle || null,
              department: item.department || null,
              companyId: item.companyId || null,
              address: item.address || null,
              city: item.city || null,
              state: item.state || null,
              postcode: item.postcode || null,
              country: item.country || null,
              notes: item.notes || null,
              source: item.source || 'import',
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
