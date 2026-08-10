import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { dispatchWebhookEvent } from '@/lib/webhooks';
import crypto from 'crypto';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const quote = await prisma.quote.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: 'asc' } },
      signature: true,
    },
  });
  if (!quote) return errorResponse('Quote not found', 404);
  return jsonResponse(quote);
}, 'quotes', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();
  const tenantId = session.user.tenantId;

  const quote = await prisma.quote.findFirst({ where: { id, tenantId } });
  if (!quote) return errorResponse('Quote not found', 404);

  // If items array provided, do a full recalculation in a transaction
  if (body.items) {
    const rawItems = body.items;
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

    const subtotal = lineItems.reduce((s: number, li: any) => {
      const lineNet = li.quantity * li.unitPrice - (li.quantity * li.unitPrice * li.discount / 100);
      return s + lineNet;
    }, 0);

    const taxTotal = lineItems.reduce((s: number, li: any) => {
      const lineNet = li.quantity * li.unitPrice - (li.quantity * li.unitPrice * li.discount / 100);
      return s + (lineNet * li.taxRate / 100);
    }, 0);

    const quoteDiscount = body.discount !== undefined ? parseFloat(body.discount) || 0 : quote.discount;
    const quoteDiscountType = body.discountType || quote.discountType;
    const discountAmount = quoteDiscountType === 'percentage'
      ? subtotal * quoteDiscount / 100
      : quoteDiscount;
    const total = subtotal + taxTotal - discountAmount;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });

      return tx.quote.update({
        where: { id },
        data: {
          title: body.title ?? quote.title,
          companyId: body.companyId !== undefined ? (body.companyId || null) : quote.companyId,
          contactId: body.contactId !== undefined ? (body.contactId || null) : quote.contactId,
          opportunityId: body.opportunityId !== undefined ? (body.opportunityId || null) : quote.opportunityId,
          currency: body.currency || quote.currency,
          validUntil: body.validUntil !== undefined ? (body.validUntil ? new Date(body.validUntil) : null) : quote.validUntil,
          discount: quoteDiscount,
          discountType: quoteDiscountType,
          notes: body.notes !== undefined ? body.notes : quote.notes,
          terms: body.terms !== undefined ? body.terms : quote.terms,
          internalNotes: body.internalNotes !== undefined ? body.internalNotes : quote.internalNotes,
          subtotal,
          taxTotal,
          total,
          items: { create: lineItems },
        },
        include: {
          items: { orderBy: { sortOrder: 'asc' } },
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      });
    });

    return jsonResponse(updated);
  }

  // Simple field updates (no items)
  const data: any = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.companyId !== undefined) data.companyId = body.companyId || null;
  if (body.contactId !== undefined) data.contactId = body.contactId || null;
  if (body.opportunityId !== undefined) data.opportunityId = body.opportunityId || null;
  if (body.currency !== undefined) data.currency = body.currency;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.terms !== undefined) data.terms = body.terms;
  if (body.internalNotes !== undefined) data.internalNotes = body.internalNotes;
  if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
  if (body.discount !== undefined) data.discount = parseFloat(body.discount) || 0;
  if (body.discountType !== undefined) data.discountType = body.discountType;

  // Status changes with timestamps
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === 'sent' && !quote.sentAt) {
      data.sentAt = new Date();
      if (!quote.accessToken) {
        data.accessToken = crypto.randomUUID();
      }
    }
    if (body.status === 'viewed' && !quote.viewedAt) data.viewedAt = new Date();
    if (body.status === 'accepted' && !quote.acceptedAt) data.acceptedAt = new Date();
    if (body.status === 'declined' && !quote.declinedAt) {
      data.declinedAt = new Date();
      if (body.rejectedReason) data.rejectedReason = body.rejectedReason;
    }
  }

  const updated = await prisma.quote.update({
    where: { id },
    data,
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      company: { select: { id: true, name: true } },
    },
  });
  // Audit log
  await prisma.auditLog.create({
    data: { tenantId: session.user.tenantId, userId: session.user.id, action: 'updated', entityType: 'quote', entityId: id, changes: body },
  });

  // Webhook
  const eventName = body.status ? `quote.${body.status}` : 'quote.updated';
  dispatchWebhookEvent(session.user.tenantId, eventName, updated);

  return jsonResponse(updated);
}, 'quotes', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const quote = await prisma.quote.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!quote) return errorResponse('Quote not found', 404);
  await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
  await prisma.quote.delete({ where: { id } });

  // Audit + webhook
  await prisma.auditLog.create({
    data: { tenantId: session.user.tenantId, userId: session.user.id, action: 'deleted', entityType: 'quote', entityId: id, changes: { quoteNumber: quote.quoteNumber } },
  });
  dispatchWebhookEvent(session.user.tenantId, 'quote.deleted', { id, quoteNumber: quote.quoteNumber });

  return jsonResponse({ success: true });
}, 'quotes', 'write');
