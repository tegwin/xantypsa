// ============================================================
// Recording a payment against an invoice
// ============================================================
// One place, used by the manual "record payment" form and by the inbound
// payment webhook, so a payment lands the same way however it arrived.

import { prisma } from './prisma';

export interface RecordPaymentInput {
  tenantId: string;
  invoiceId: string;
  amount: number;
  method?: string;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date;
}

/**
 * Add a payment and bring the invoice's balance and status in line.
 *
 * Part paid sets `partial`, which the old inline version never did: anything
 * short of the full amount left the invoice looking unpaid.
 */
export async function recordPayment(input: RecordPaymentInput) {
  const { tenantId, invoiceId, amount } = input;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    select: { id: true, total: true, amountPaid: true, status: true, invoiceNumber: true },
  });
  if (!invoice) throw new Error('Invoice not found');
  if (!(amount > 0)) throw new Error('A payment must be greater than zero');

  const paidAt = input.paidAt ?? new Date();

  const payment = await prisma.payment.create({
    data: {
      tenantId,
      invoiceId,
      amount,
      paidAt,
      method: input.method || 'bank_transfer',
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    },
  });

  const paidTotal = Math.round(((invoice.amountPaid || 0) + amount) * 100) / 100;
  // A rounding penny should not leave an invoice forever one pence short.
  const settled = paidTotal >= invoice.total - 0.005;

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      amountPaid: paidTotal,
      amountDue: Math.max(Math.round((invoice.total - paidTotal) * 100) / 100, 0),
      status: settled ? 'paid' : paidTotal > 0 ? 'partial' : invoice.status,
      ...(settled ? { paidAt } : {}),
    },
    select: { id: true, invoiceNumber: true, status: true, amountPaid: true, amountDue: true, total: true },
  });

  return { payment, invoice: updated };
}
