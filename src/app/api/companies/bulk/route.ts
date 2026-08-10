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
        try {
          await tx.company.create({
            data: {
              ...items[i],
              tenantId,
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

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
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
  let updated = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const { id, ...fields } = items[i];
        if (!id) {
          errors.push({ index: i, error: 'id is required' });
          continue;
        }

        try {
          await tx.company.update({
            where: { id, tenantId },
            data: fields,
          });
          updated++;
        } catch (err: any) {
          errors.push({ index: i, error: err.message });
        }
      }
    });
  } catch (err: any) {
    return errorResponse(`Transaction failed: ${err.message}`, 500);
  }

  return jsonResponse({ updated, errors }, errors.length > 0 ? 207 : 200);
});
