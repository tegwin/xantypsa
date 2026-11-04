import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { recordPayment } from '@/lib/payments';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const invoiceId = segments[segments.length - 2];
  const body = await req.json();
  const { amount, paymentDate, method, reference, notes } = body;

  if (!amount || amount <= 0) return errorResponse('Valid amount required', 400);

  try {
    const { payment } = await recordPayment({
      tenantId: session.user.tenantId,
      invoiceId,
      amount,
      method,
      reference,
      notes,
      // The client sends `paymentDate`; the column is `paidAt`.
      paidAt: paymentDate ? new Date(paymentDate) : undefined,
    });
    return jsonResponse(payment, 201);
  } catch (err: any) {
    return errorResponse(err.message || 'Could not record the payment', 400);
  }
}, 'invoices', 'write');
