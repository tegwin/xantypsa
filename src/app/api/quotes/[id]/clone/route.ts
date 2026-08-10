import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getNextNumber } from '@/lib/server-utils';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('quotes') + 1];
  const tenantId = session.user.tenantId;

  const original = await prisma.quote.findFirst({
    where: { id, tenantId },
    include: { items: true },
  });
  if (!original) return errorResponse('Quote not found', 404);

  const quoteNumber = await getNextNumber(tenantId, 'quote');

  const clone = await prisma.quote.create({
    data: {
      tenantId,
      quoteNumber,
      title: `${original.title} (Copy)`,
      status: 'draft',
      companyId: original.companyId,
      contactId: original.contactId,
      opportunityId: original.opportunityId,
      createdById: session.user.id,
      currency: original.currency,
      discount: original.discount,
      discountType: original.discountType,
      subtotal: original.subtotal,
      taxTotal: original.taxTotal,
      total: original.total,
      validUntil: null,
      notes: original.notes,
      terms: original.terms,
      internalNotes: original.internalNotes,
      items: {
        create: original.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount,
          total: item.total,
          sortOrder: item.sortOrder,
          isOptional: item.isOptional,
          section: item.section,
          billingType: item.billingType,
          billingPeriod: item.billingPeriod,
          costPrice: item.costPrice,
          productId: item.productId,
        })),
      },
    },
    include: { items: true },
  });

  return jsonResponse(clone, 201);
}, 'quotes', 'write');
