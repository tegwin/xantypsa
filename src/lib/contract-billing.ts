// ============================================================
// Contract -> recurring invoice generation
// ============================================================
// A contract is never billed directly. It absorbs labour and defines the price;
// the recurring invoice raised against it is the billing mechanism.

import { prisma } from './prisma';
import { getNextNumber } from './server-utils';
import { addPeriod, calculateTotals, round2 } from './billing';

const TERMS_DAYS: Record<string, number> = {
  due_on_receipt: 0,
  net_15: 15,
  net_30: 30,
  net_60: 60,
};

/**
 * Create the recurring invoice for a contract.
 *
 * The invoice created here is both the opening bill (immediately visible in
 * Ready to Bill) and the schedule anchor that process-recurring emits future
 * periods from.
 */
export async function createRecurringInvoiceForContract(opts: {
  tenantId: string;
  contractId: string;
  userId: string;
  paymentTerms?: string;
}) {
  const { tenantId, contractId, userId } = opts;
  const paymentTerms = opts.paymentTerms || 'net_30';

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: { items: { include: { product: true } } },
  });

  if (!contract) throw new Error('Contract not found');

  // Line items come from the contract's products/services. Only recurring items
  // belong on a recurring invoice; one-off items are billed separately.
  const source = contract.items.filter((ci) => ci.recurring !== false);
  const lineItems = source.map((ci, i) => {
    const quantity = ci.quantity || 1;
    const unitPrice = ci.unitPrice || 0;
    const taxRate = ci.taxRate ?? 20;
    const lineNet = quantity * unitPrice;
    return {
      description: ci.description || ci.product?.name || '',
      quantity,
      unitPrice,
      taxRate,
      discount: 0,
      total: round2(lineNet + lineNet * (taxRate / 100)),
      sortOrder: i,
      productId: ci.productId || undefined,
    };
  });

  // A pre-pay contract is billed by its blocks, one line each, and only the
  // blocks that have not been invoiced yet. Billing the contract's running
  // total would re-charge every block each time a new one was added.
  let billedBlockIds: string[] = [];
  if (lineItems.length === 0 && contract.type === 'prepay_hours') {
    const unbilled = await prisma.contractHourBlock.findMany({
      where: { contractId, tenantId, invoiceId: null, amount: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
    });

    if (unbilled.length === 0) {
      throw new Error('Every block on this contract has already been invoiced.');
    }

    billedBlockIds = unbilled.map((b) => b.id);
    unbilled.forEach((b, i) => {
      const rate = b.hourlyRate ?? 0;
      const net = round2(b.hours * rate);
      const period = b.periodStart
        ? ` ${b.periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
        : '';
      lineItems.push({
        description:
          `${contract.name}${period}${b.source === 'top_up' ? ' top-up' : ''}`
          + ` - ${b.hours} hours at ${rate.toFixed(2)} per hour`,
        quantity: b.hours,
        unitPrice: rate,
        taxRate: 20,
        discount: 0,
        total: round2(net * 1.2),
        sortOrder: i,
        productId: undefined,
      });
    });
  }

  // Contracts with no items still bill their headline value.
  if (lineItems.length === 0) {
    const value = contract.monthlyFee || contract.fixedPrice || contract.value || 0;
    lineItems.push({
      description: contract.name,
      quantity: 1,
      unitPrice: value,
      taxRate: 20,
      discount: 0,
      total: round2(value * 1.2),
      sortOrder: 0,
      productId: undefined,
    });
  }

  const { subtotal, taxTotal, total } = calculateTotals(lineItems);

  // A one-off block is billed once. Only a monthly block recurs.
  const isOneOffBlock = contract.type === 'prepay_hours' && contract.blockMode !== 'monthly';
  const freq = contract.billingCycle || 'monthly';
  // Bill from the contract start if it is in the future, otherwise from today.
  const anchor =
    contract.startDate && contract.startDate > new Date() ? new Date(contract.startDate) : new Date();

  const days = TERMS_DAYS[paymentTerms] ?? 30;
  const dueDate = new Date(Date.now() + days * 86400000);

  const invoiceNumber = await getNextNumber(tenantId, 'invoice');

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber,
      title: `${contract.name} - ${freq} charge`,
      companyId: contract.companyId,
      contractId: contract.id,
      createdById: userId,
      status: 'draft', // draft = awaiting billing, so it lands in Ready to Bill
      dueDate,
      paymentTerms,
      // A one-off block is a single bill: flagging it recurring would raise an
      // invoice every month for a block nobody bought.
      isRecurring: !isOneOffBlock,
      recurringFreq: isOneOffBlock ? null : freq,
      nextRecurring: isOneOffBlock ? null : addPeriod(anchor, freq),
      subtotal,
      taxTotal,
      total,
      amountDue: total,
      items: { create: lineItems },
    },
    include: { items: true, company: { select: { name: true } } },
  });

  // Mark the blocks billed, so the same hours can never reach a second invoice.
  if (billedBlockIds.length > 0) {
    await prisma.contractHourBlock.updateMany({
      where: { id: { in: billedBlockIds }, contractId, tenantId },
      data: { invoiceId: invoice.id },
    });
  }

  // Keep the contract's headline value in step with what it actually bills,
  // NET. A pre-pay contract is worth its blocks, which this invoice only
  // covers part of, so its value is left alone.
  if (contract.type !== 'prepay_hours') {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { value: subtotal },
    });
  }

  return invoice;
}
