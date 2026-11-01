// ============================================================
// Cost and profitability
// ============================================================
// Revenue is what we charge the customer. Cost is what delivering it actually
// costs us: engineer time plus any services we resell (M365 seats, backup,
// licensing). Profit is the difference.

import { prisma } from './prisma';
import { round2 } from './billing';

/**
 * Work out what an hour of this engineer's time costs us.
 *
 * Order of preference:
 *   1. The engineer's own cost rate - most accurate, since a senior engineer
 *      costs more than a junior doing the same task.
 *   2. The billing rate's cost rate - a per-rate-card fallback.
 *   3. Zero, which makes the work look free. Surfaced as `hasRate: false` so
 *      reports can flag it rather than quietly overstating profit.
 */
export async function resolveCostRate(
  userId: string,
  tenantId: string,
  billingRateId?: string | null
): Promise<{ costRate: number; source: 'user' | 'billing_rate' | 'none'; hasRate: boolean }> {
  // Cost is a property of the engineer's membership of *this* tenant, so the
  // same person can cost a different amount to each MSP they work for.
  const membership = await prisma.tenantUser.findFirst({
    where: { userId, tenantId },
    select: { costRate: true },
  });

  if (membership?.costRate != null && membership.costRate > 0) {
    return { costRate: membership.costRate, source: 'user', hasRate: true };
  }

  if (billingRateId) {
    const rate = await prisma.billingRate.findUnique({
      where: { id: billingRateId },
      select: { costRate: true },
    });
    if (rate?.costRate) {
      return { costRate: rate.costRate, source: 'billing_rate', hasRate: true };
    }
  }

  return { costRate: 0, source: 'none', hasRate: false };
}

/**
 * The cash cost of a block of work.
 *
 * Deliberately snapshotted onto the time entry rather than computed later: when
 * an engineer's rate changes, last quarter's profitability must not silently
 * change with it.
 */
export async function calculateInternalCost(
  userId: string,
  tenantId: string,
  hours: number,
  billingRateId?: string | null
): Promise<number> {
  const { costRate } = await resolveCostRate(userId, tenantId, billingRateId);
  return round2(hours * costRate);
}

export interface Profitability {
  revenue: number;      // NET, excluding tax
  labourCost: number;   // engineer time
  serviceCost: number;  // resold services (M365 etc.)
  totalCost: number;
  profit: number;
  marginPercent: number;
  hours: number;
  /** True when some time was logged by an engineer with no cost rate set. */
  incompleteCosting: boolean;
}

/**
 * Profitability for one contract over a period.
 *
 * Worked example - a £400/month contract, one hour logged by an engineer whose
 * cost rate is £40, and £100/month of resold M365:
 *
 *   revenue 400 − labour 40 − services 100 = £260 profit (65% margin)
 */
export async function contractProfitability(
  contractId: string,
  tenantId: string,
  opts: { from?: Date; to?: Date } = {}
): Promise<Profitability> {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: { items: true },
  });
  if (!contract) throw new Error('Contract not found');

  const dateFilter =
    opts.from || opts.to
      ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
      : {};

  // Revenue: what the contract bills, NET of tax.
  const revenue = contract.value ?? 0;

  // Labour: every hour logged against this contract, at its snapshotted cost.
  const timeEntries = await prisma.timeEntry.findMany({
    where: { contractId, tenantId, ...dateFilter },
    select: { hours: true, internalCost: true },
  });

  const labourCost = round2(timeEntries.reduce((s, t) => s + (t.internalCost ?? 0), 0));
  const hours = round2(timeEntries.reduce((s, t) => s + (t.hours ?? 0), 0));
  const incompleteCosting = timeEntries.some((t) => t.hours > 0 && !t.internalCost);

  // Services: the wholesale cost of anything resold on the contract.
  const serviceCost = round2(
    contract.items.reduce((s, i) => s + (i.cost ?? 0) * (i.quantity ?? 1), 0)
  );

  const totalCost = round2(labourCost + serviceCost);
  const profit = round2(revenue - totalCost);

  return {
    revenue: round2(revenue),
    labourCost,
    serviceCost,
    totalCost,
    profit,
    marginPercent: revenue > 0 ? round2((profit / revenue) * 100) : 0,
    hours,
    incompleteCosting,
  };
}
