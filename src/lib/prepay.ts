// ============================================================
// Prepaid hour blocks
// ============================================================
// A prepay contract is sold as a block of hours. It can be a single block, or
// one raised every month. Work draws the balance down; the contract keeps
// running totals so a glance answers "how much is left", while the blocks keep
// the detail of what was sold, when, and for how much.

import { prisma } from './prisma';
import { round2 } from './billing';

export interface BlockBalance {
  purchased: number;
  used: number;
  remaining: number;
  /** True once the balance has crossed the contract's alert threshold. */
  lowBalance: boolean;
}

/** Start of the month a date falls in, in UTC so it does not drift. */
function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthEnd(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}


/**
 * Make sure a one-off contract has the block it was sold with.
 *
 * The hours live on the contract as well as in blocks, and a contract can be
 * created or edited without a block ever being raised. Without this, the
 * balance reads zero and every hour looks like it is beyond the block.
 *
 * Idempotent: it does nothing once any block exists.
 */
export async function ensureOpeningBlock(contractId: string, tenantId: string) {
  const existing = await prisma.contractHourBlock.count({ where: { contractId, tenantId } });
  if (existing > 0) return null;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId, type: 'prepay_hours' },
  });
  if (!contract) return null;

  // A monthly contract gets its blocks from the scheduled job, not from here.
  if (contract.blockMode === 'monthly') return null;
  if (!contract.totalHours || contract.totalHours <= 0) return null;

  const rate = contract.blockHourlyRate ?? 0;
  const block = await prisma.contractHourBlock.create({
    data: {
      tenantId,
      contractId,
      source: 'one_off',
      hours: contract.totalHours,
      hoursUsed: contract.hoursUsed ?? 0,
      hourlyRate: rate,
      amount: round2(contract.totalHours * rate),
    },
  });
  return block;
}

export async function blockBalance(contractId: string, tenantId: string): Promise<BlockBalance> {
  await ensureOpeningBlock(contractId, tenantId);
  const [contract, blocks] = await Promise.all([
    prisma.contract.findFirst({ where: { id: contractId, tenantId } }),
    prisma.contractHourBlock.findMany({ where: { contractId, tenantId } }),
  ]);

  const purchased = round2(blocks.reduce((a, b) => a + b.hours, 0));
  const used = round2(blocks.reduce((a, b) => a + b.hoursUsed, 0));
  const remaining = round2(purchased - used);

  // Threshold is a percentage of what was bought.
  const pct = contract?.alertThreshold ?? null;
  const lowBalance =
    pct != null && purchased > 0 ? (used / purchased) * 100 >= pct : false;

  return { purchased, used, remaining, lowBalance };
}

/**
 * Raise the block for the current month on a monthly contract, if it is not
 * there yet, carrying over unused hours from last month where the contract
 * says to.
 *
 * Idempotent: called repeatedly within a month it does nothing after the first
 * time, which is what lets a scheduled job run as often as it likes.
 */
export async function ensureCurrentPeriodBlock(contractId: string, tenantId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId, type: 'prepay_hours', status: 'active' },
  });
  if (!contract || contract.blockMode !== 'monthly' || !contract.hoursPerPeriod) return null;

  const now = new Date();
  const start = monthStart(now);
  const end = monthEnd(now);

  const existing = await prisma.contractHourBlock.findFirst({
    where: { contractId, tenantId, source: 'monthly', periodStart: start },
  });
  if (existing) return existing;

  const rate = contract.blockHourlyRate ?? 0;
  const created = await prisma.contractHourBlock.create({
    data: {
      tenantId,
      contractId,
      source: 'monthly',
      hours: contract.hoursPerPeriod,
      hourlyRate: rate,
      amount: round2(contract.hoursPerPeriod * rate),
      periodStart: start,
      periodEnd: end,
    },
  });

  if (contract.carryOver) await carryOverUnusedHours(contractId, tenantId, start);
  await refreshContractTotals(contractId, tenantId);
  return created;
}

/**
 * Move unused hours from the blocks of previous periods into the new one.
 *
 * Hours are carried as their own block worth nothing, because the customer has
 * already paid for them. The previous blocks are marked fully used so the same
 * hours cannot be carried twice.
 */
async function carryOverUnusedHours(contractId: string, tenantId: string, intoPeriodStart: Date) {
  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
  if (!contract?.carryOver) return;

  const previous = await prisma.contractHourBlock.findMany({
    where: {
      contractId,
      tenantId,
      periodStart: { lt: intoPeriodStart },
    },
  });

  let unused = round2(previous.reduce((a, b) => a + (b.hours - b.hoursUsed), 0));
  if (unused <= 0) return;

  // The cap is on how many hours may be carried, not on the balance.
  if (contract.carryOverMaxHours != null) {
    unused = Math.min(unused, contract.carryOverMaxHours);
  }
  if (unused <= 0) return;

  await prisma.$transaction([
    prisma.contractHourBlock.create({
      data: {
        tenantId,
        contractId,
        source: 'carry_over',
        hours: unused,
        hourlyRate: 0,
        amount: 0, // already paid for in the period it was bought
        periodStart: intoPeriodStart,
      },
    }),
    ...previous
      .filter((b) => b.hours > b.hoursUsed)
      .map((b) =>
        prisma.contractHourBlock.update({
          where: { id: b.id },
          data: { hoursUsed: b.hours },
        }),
      ),
  ]);
}

/**
 * Raise a top-up block when the balance has run low.
 *
 * Returns the block it created, or null when the contract does not top up or
 * the balance has not fallen far enough yet.
 */
export async function maybeTopUp(contractId: string, tenantId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId, type: 'prepay_hours', status: 'active' },
  });
  if (!contract?.autoTopUp || !contract.topUpHours) return null;

  const threshold = contract.topUpThresholdHours ?? 0;
  const { remaining } = await blockBalance(contractId, tenantId);
  if (remaining > threshold) return null;

  const rate = contract.blockHourlyRate ?? 0;
  const block = await prisma.contractHourBlock.create({
    data: {
      tenantId,
      contractId,
      source: 'top_up',
      hours: contract.topUpHours,
      hourlyRate: rate,
      amount: round2(contract.topUpHours * rate),
    },
  });

  await refreshContractTotals(contractId, tenantId);
  return block;
}

/**
 * Draw hours off the balance, oldest block first so the hours that were bought
 * first are the hours that get used first.
 *
 * Returns how many hours could not be covered. Those are the caller's problem:
 * they are charged at the overhour rate, or refused, depending on the contract.
 */
export async function consumeHours(
  contractId: string,
  tenantId: string,
  hours: number,
): Promise<{ consumed: number; uncovered: number }> {
  if (hours <= 0) return { consumed: 0, uncovered: 0 };

  await ensureOpeningBlock(contractId, tenantId);

  const blocks = await prisma.contractHourBlock.findMany({
    where: { contractId, tenantId },
    orderBy: [{ periodStart: 'asc' }, { createdAt: 'asc' }],
  });

  let left = hours;
  const updates = [];

  for (const b of blocks) {
    if (left <= 0) break;
    const free = b.hours - b.hoursUsed;
    if (free <= 0) continue;
    const take = Math.min(free, left);
    left = round2(left - take);
    updates.push(
      prisma.contractHourBlock.update({
        where: { id: b.id },
        data: { hoursUsed: round2(b.hoursUsed + take) },
      }),
    );
  }

  if (updates.length > 0) await prisma.$transaction(updates);
  await refreshContractTotals(contractId, tenantId);
  await maybeTopUp(contractId, tenantId);

  return { consumed: round2(hours - left), uncovered: round2(left) };
}

/** Recompute the running totals the contract carries for display. */
export async function refreshContractTotals(contractId: string, tenantId: string) {
  const blocks = await prisma.contractHourBlock.findMany({
    where: { contractId, tenantId },
    select: { hours: true, hoursUsed: true },
  });
  if (blocks.length === 0) return;

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      totalHours: round2(blocks.reduce((a, b) => a + b.hours, 0)),
      hoursUsed: round2(blocks.reduce((a, b) => a + b.hoursUsed, 0)),
    },
  });
}
