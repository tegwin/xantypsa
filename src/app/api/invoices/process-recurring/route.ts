import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getNextNumber } from '@/lib/server-utils';
import { addPeriod } from '@/lib/billing';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const now = new Date();

  // Find all recurring invoices due for processing
  const recurringInvoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      isRecurring: true,
      nextRecurring: { lte: now },
      status: { not: 'cancelled' },
      // A one-off block is billed once. If one ever ended up flagged recurring,
      // it must not keep raising invoices for a block nobody bought.
      NOT: {
        contract: { type: 'prepay_hours', blockMode: 'one_off' },
      },
    },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });

  let processed = 0;

  for (const source of recurringInvoices) {
    const invoiceNumber = await getNextNumber(tenantId, 'invoice');
    const freq = source.recurringFreq || 'monthly';

    // Calculate due date from payment terms
    const termsDays: Record<string, number> = { due_on_receipt: 0, net_15: 15, net_30: 30, net_60: 60 };
    const days = termsDays[source.paymentTerms] ?? 30;
    const dueDate = new Date(Date.now() + days * 86400000);

    // Copy line items
    const lineItems = source.items.map((li: any, i: number) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      taxRate: li.taxRate,
      discount: li.discount || 0,
      total: li.total,
      sortOrder: i,
      productId: li.productId || undefined,
    }));

    // Create the new invoice
    await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber,
        title: source.title || `Invoice ${invoiceNumber}`,
        companyId: source.companyId,
        contactId: source.contactId,
        contractId: source.contractId,
        createdById: source.createdById,
        dueDate,
        notes: source.notes,
        terms: source.terms,
        paymentTerms: source.paymentTerms,
        // The emitted invoice is a bill, NOT another schedule. Marking copies as
        // recurring made every generated invoice spawn its own copies, doubling
        // the number of recurring invoices every period.
        isRecurring: false,
        recurringFreq: null,
        nextRecurring: null,
        subtotal: source.subtotal,
        taxTotal: source.taxTotal,
        total: source.total,
        amountDue: source.total,
        items: { create: lineItems },
      },
    });

    // Update the source invoice's nextRecurring to the next period
    await prisma.invoice.update({
      where: { id: source.id },
      data: {
        nextRecurring: addPeriod(source.nextRecurring || now, freq),
      },
    });

    processed++;
  }

  return jsonResponse({ processed, message: `Processed ${processed} recurring invoice(s)` });
}, 'invoices', 'write');
