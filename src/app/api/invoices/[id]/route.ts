import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  const idx = segments.indexOf('invoices');
  if (idx >= 0 && idx + 1 < segments.length) {
    return segments[idx + 1];
  }
  return segments.pop()!;
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        company: { select: { id: true, name: true } },
        contact: true,
        contract: { select: { id: true, contractNumber: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!invoice) return errorResponse('Invoice not found', 404);
    return jsonResponse(invoice);
  } catch (err: any) {
    console.error('Invoice GET error:', err);
    return errorResponse(err.message || 'Failed to load invoice', 500);
  }
}, 'invoices', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const body = await req.json();

  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!invoice) return errorResponse('Invoice not found', 404);

  const data: any = {};
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === 'sent' && !invoice.sentAt) data.sentAt = new Date();
    if (body.status === 'paid') data.paidAt = new Date();
  }
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const updated = await prisma.invoice.update({
    where: { id },
    data,
    include: {
      company: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return jsonResponse(updated);
}, 'invoices', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const invoice = await prisma.invoice.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!invoice) return errorResponse('Invoice not found', 404);

  await prisma.payment.deleteMany({ where: { invoiceId: id } });
  await prisma.invoice.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'invoices', 'write');
