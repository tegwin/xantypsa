// ============================================================
// What counts as ready to invoice
// ============================================================
// Defined once, so the Ready for Invoicing screen and the Bill all action can
// never disagree. If the screen shows it, this is what gets billed.

import { prisma } from '../prisma';

/** Billable time charged time and materials. Contract-covered time is billed by the contract. */
export const unbilledLabourWhere = (tenantId: string) => ({
  tenantId,
  billable: true,
  billed: false,
  chargeType: { notIn: ['contract', 'non_billable'] },
});

/** Accepted quotes nobody has converted. */
export const unconvertedQuotesWhere = (tenantId: string) => ({
  tenantId,
  status: 'accepted',
  invoice: null,
});

/**
 * Completed fixed-price projects with no invoice against them.
 *
 * The invoice link is what stops a project being billed twice, which matters
 * far more now that one click can bill everything at once.
 */
export const unbilledProjectsWhere = (tenantId: string) => ({
  tenantId,
  status: 'completed',
  billingMethod: 'fixed',
  invoices: { none: {} },
});

/** Contracts carrying something to bill, both kinds. */
export const billableContractsWhere = (tenantId: string) => ({
  tenantId,
  status: 'active',
  type: { in: ['prepay_hours', 'managed_service', 'fixed_price'] },
});

/** A contract is due when it has an unbilled block, or has never been invoiced. */
export function contractIsDue(c: {
  type: string;
  billingMode?: string | null;
  hourBlocks: { amount: number }[];
  _count: { invoices: number };
}): boolean {
  if (c.type === 'prepay_hours') return c.hourBlocks.some((b) => b.amount > 0);
  if (c.type === 'fixed_price' && c.billingMode === 'one_off') return c._count.invoices === 0;
  if (c.type === 'managed_service') return c._count.invoices === 0;
  return false;
}

export interface ReadyWork {
  labour: Awaited<ReturnType<typeof gatherReadyWork>>['labour'];
}

/**
 * Everything waiting to be invoiced, as the records themselves.
 *
 * Read in one go: the database is a network hop away, so these must not run
 * one after another.
 */
export async function gatherReadyWork(tenantId: string) {
  const [labour, quotes, projects, contracts] = await Promise.all([
    prisma.timeEntry.findMany({
      where: unbilledLabourWhere(tenantId),
      include: {
        billingRate: { select: { name: true, code: true } },
        ticket: { select: { ticketNumber: true, title: true, companyId: true } },
        project: { select: { companyId: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.quote.findMany({
      where: unconvertedQuotesWhere(tenantId),
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.project.findMany({
      where: unbilledProjectsWhere(tenantId),
      select: { id: true, name: true, companyId: true, budgetAmount: true },
    }),
    prisma.contract.findMany({
      where: billableContractsWhere(tenantId),
      include: {
        _count: { select: { invoices: true } },
        items: { where: { recurring: true } },
        hourBlocks: { where: { invoiceId: null }, orderBy: { createdAt: 'asc' } },
      },
    }),
  ]);

  const due = contracts.filter(contractIsDue);
  return {
    labour,
    quotes,
    projects,
    blockContracts: due.filter((c) => c.type === 'prepay_hours'),
    productContracts: due.filter((c) => c.type !== 'prepay_hours'),
  };
}
