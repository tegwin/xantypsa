import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';
import { dispatchWebhookEvent } from '@/lib/webhooks';
import { getNextNumber } from '@/lib/server-utils';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { title: { contains: p.search, mode: 'insensitive' } },
      { quoteNumber: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.status) where.status = p.status;
  if (p.companyId) where.companyId = p.companyId;

  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        company: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.quote.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'quotes', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.title) return errorResponse('Quote title is required');

  const tenantId = session.user.tenantId;
  const quoteNumber = await getNextNumber(tenantId, 'quote');

  // Calculate line items
  const rawItems = body.items || [];
  const lineItems = rawItems.map((item: any, i: number) => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unitPrice) || 0;
    const tax = parseFloat(item.taxRate) ?? 20;
    const itemDiscount = parseFloat(item.discount) || 0;
    const lineNet = qty * price - (qty * price * itemDiscount / 100);
    const lineTax = lineNet * tax / 100;
    const lineTotal = lineNet + lineTax;
    return {
      description: item.description || '',
      quantity: qty,
      unitPrice: price,
      taxRate: tax,
      discount: itemDiscount,
      total: lineTotal,
      sortOrder: item.sortOrder ?? i,
      isOptional: item.isOptional || false,
      section: item.section || null,
      productId: item.productId || undefined,
      billingType: item.billingType || 'one_off',
      billingPeriod: item.billingPeriod || null,
      costPrice: item.costPrice != null ? parseFloat(item.costPrice) : null,
    };
  });

  // Calculate quote-level totals
  const subtotal = lineItems.reduce((s: number, li: any) => {
    const qty = li.quantity;
    const price = li.unitPrice;
    const d = li.discount || 0;
    return s + (qty * price - qty * price * d / 100);
  }, 0);

  const taxTotal = lineItems.reduce((s: number, li: any) => {
    const qty = li.quantity;
    const price = li.unitPrice;
    const d = li.discount || 0;
    const lineNet = qty * price - qty * price * d / 100;
    return s + (lineNet * li.taxRate / 100);
  }, 0);

  const quoteDiscount = parseFloat(body.discount) || 0;
  const quoteDiscountType = body.discountType || 'percentage';
  const discountAmount = quoteDiscountType === 'percentage'
    ? subtotal * quoteDiscount / 100
    : quoteDiscount;
  const total = subtotal + taxTotal - discountAmount;

  const quote = await prisma.quote.create({
    data: {
      tenantId,
      quoteNumber,
      title: body.title,
      companyId: body.companyId || null,
      contactId: body.contactId || null,
      opportunityId: body.opportunityId || null,
      createdById: session.user.id,
      currency: body.currency || 'GBP',
      validUntil: body.validUntil ? new Date(body.validUntil) : null,
      discount: quoteDiscount,
      discountType: quoteDiscountType,
      notes: body.notes || null,
      terms: body.terms || null,
      internalNotes: body.internalNotes || null,
      subtotal,
      taxTotal,
      total,
      items: { create: lineItems },
    },
    include: { items: true, company: { select: { name: true } } },
  });

  // Audit log
  await prisma.auditLog.create({
    data: { tenantId, userId: session.user.id, action: 'created', entityType: 'quote', entityId: quote.id, changes: { quoteNumber: quote.quoteNumber, title: quote.title } },
  });

  // Webhook
  dispatchWebhookEvent(tenantId, 'quote.created', quote);

  return jsonResponse(quote, 201);
}, 'quotes', 'write');
