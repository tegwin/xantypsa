// ============================================================
// Shared billing helpers
// ============================================================

export type BillingFrequency = 'monthly' | 'quarterly' | 'annually' | string;

/** Advance a date by one billing period. Unknown frequencies fall back to monthly. */
export function addPeriod(date: Date, freq: BillingFrequency): Date {
  const next = new Date(date);
  switch (freq) {
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

export interface LineItemInput {
  quantity?: number | null;
  unitPrice?: number | null;
  taxRate?: number | null;
  discount?: number | null;
}

/**
 * Totals for a set of line items.
 * `subtotal` is NET (before tax) - a contract's value is always the net figure.
 */
export function calculateTotals(items: LineItemInput[]) {
  let subtotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    const qty = item.quantity ?? 1;
    const price = item.unitPrice ?? 0;
    const discount = item.discount ?? 0;
    const taxRate = item.taxRate ?? 20;

    const lineNet = qty * price * (1 - discount / 100);
    subtotal += lineNet;
    taxTotal += lineNet * (taxRate / 100);
  }

  return {
    subtotal: round2(subtotal),
    taxTotal: round2(taxTotal),
    total: round2(subtotal + taxTotal),
  };
}

/** Money rounded to 2dp, avoiding float drift like 0.1 + 0.2. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
