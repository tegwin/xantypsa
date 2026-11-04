import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';
import { getNextNumber } from '@/lib/server-utils';
import { addPeriod } from '@/lib/billing';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { invoiceNumber: { contains: p.search, mode: 'insensitive' } },
      { title: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  // The status tiles group several statuses under one heading, so a filter is
  // either one of those groups or a plain status.
  const STATUS_GROUPS: Record<string, string[]> = {
    unpaid: ['sent', 'viewed'],
    void: ['void', 'cancelled', 'refunded'],
  };
  if (p.status) {
    const group = STATUS_GROUPS[p.status];
    where.status = group ? { in: group } : p.status;
  }
  if (p.companyId) where.companyId = p.companyId;

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true, payments: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'invoices', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const tenantId = session.user.tenantId;
  const invoiceNumber = await getNextNumber(tenantId, 'invoice');

  const lineItems = (body.lineItems || []).map((item: any, i: number) => {
    const qty = item.quantity || 1;
    const price = item.unitPrice || 0;
    const tax = item.taxRate ?? 20;
    const disc = item.discount || 0;
    const lineNet = qty * price * (1 - disc / 100);
    const lineTax = lineNet * tax / 100;
    const lineTotal = lineNet + lineTax;
    return {
      description: item.description || '',
      quantity: qty,
      unitPrice: price,
      taxRate: tax,
      discount: disc,
      total: lineTotal,
      sortOrder: i,
      productId: item.productId || undefined,
    };
  });

  const subtotal = lineItems.reduce((s: number, li: any) => s + li.quantity * li.unitPrice * (1 - li.discount / 100), 0);
  const taxTotal = lineItems.reduce((s: number, li: any) => {
    const lineNet = li.quantity * li.unitPrice * (1 - li.discount / 100);
    return s + lineNet * li.taxRate / 100;
  }, 0);
  const total = subtotal + taxTotal;

  // Calculate due date from payment terms
  const termsDays: Record<string, number> = { due_on_receipt: 0, net_15: 15, net_30: 30, net_60: 60 };
  const days = termsDays[body.paymentTerms] ?? 30;
  const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + days * 86400000);

  // A recurring invoice with no nextRecurring is never picked up by
  // process-recurring, so it would silently never bill. Default it to one period
  // out. Standalone recurring invoices (no contractId) are supported here too.
  const isRecurring = body.isRecurring || false;
  const recurringFreq = isRecurring ? (body.recurringFreq || 'monthly') : null;
  const nextRecurring = isRecurring
    ? (body.nextRecurring ? new Date(body.nextRecurring) : addPeriod(new Date(), recurringFreq!))
    : null;

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber,
      title: body.title || `Invoice ${invoiceNumber}`,
      companyId: body.companyId || null,
      contactId: body.contactId || null,
      contractId: body.contractId || null,
      createdById: session.user.id,
      dueDate,
      notes: body.notes || null,
      terms: body.terms || null,
      paymentTerms: body.paymentTerms || 'net_30',
      isRecurring,
      recurringFreq,
      nextRecurring,
      subtotal,
      taxTotal,
      total,
      amountDue: total,
      items: { create: lineItems },
    },
    include: { items: true, company: { select: { name: true } } },
  });

  return jsonResponse(invoice, 201);
}, 'invoices', 'write');
