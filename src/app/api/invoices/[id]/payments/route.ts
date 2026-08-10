import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const invoiceId = segments[segments.length - 2];
  const body = await req.json();
  const { amount, paymentDate, method, reference, notes } = body;

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId: session.user.tenantId } });
  if (!invoice) return errorResponse('Invoice not found', 404);
  if (!amount || amount <= 0) return errorResponse('Valid amount required', 400);

  const payment = await prisma.payment.create({
    data: {
      tenantId: session.user.tenantId,
      invoiceId,
      amount,
      // The client sends `paymentDate`; the column is `paidAt`.
      paidAt: paymentDate ? new Date(paymentDate) : new Date(),
      method: method || 'bank_transfer',
      reference: reference || null,
      notes: notes || null,
    },
  });

  const newPaidAmount = (invoice.amountPaid || 0) + amount;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: newPaidAmount,
      amountDue: Math.max(invoice.total - newPaidAmount, 0),
      ...(newPaidAmount >= invoice.total && { status: 'paid', paidAt: new Date() }),
    },
  });

  return jsonResponse(payment, 201);
}, 'invoices', 'write');
