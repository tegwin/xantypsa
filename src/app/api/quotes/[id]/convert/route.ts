import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getNextNumber } from '@/lib/server-utils';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const quoteId = segments[segments.indexOf('quotes') + 1];
  const tenantId = session.user.tenantId;

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, tenantId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!quote) return errorResponse('Quote not found', 404);
  if (quote.status !== 'accepted') {
    return errorResponse('Only accepted quotes can be converted to invoices', 400);
  }

  // Check if already converted
  const existing = await prisma.invoice.findFirst({ where: { quoteId: quote.id } });
  if (existing) {
    return errorResponse(`Quote already converted to invoice ${existing.invoiceNumber}`, 400);
  }

  const invoiceNumber = await getNextNumber(tenantId, 'invoice');
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      companyId: quote.companyId,
      contactId: quote.contactId,
      quoteId: quote.id,
      createdById: session.user.id,
      invoiceNumber,
      title: quote.title,
      status: 'draft',
      subtotal: quote.subtotal,
      taxTotal: quote.taxTotal,
      discount: quote.discount,
      total: quote.total,
      amountDue: quote.total,
      currency: quote.currency,
      issueDate: new Date(),
      dueDate,
      notes: quote.notes,
      terms: quote.terms,
      items: {
        create: quote.items
          .filter(item => !item.isOptional)
          .map((item, i) => ({
            description: item.description,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            discount: item.discount,
            total: item.total,
            sortOrder: i,
          })),
      },
    },
    include: { items: true },
  });

  return jsonResponse(invoice, 201);
}, 'invoices', 'write');
