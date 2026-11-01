import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';
import { ensureCurrentPeriodBlock, maybeTopUp } from '@/lib/prepay';

/**
 * Raise this month's block on every monthly pre-pay contract, and top up any
 * contract whose balance has run low.
 *
 * Safe to run as often as you like: a contract that already has this month's
 * block is skipped, and a top-up only happens once the balance is actually
 * below the threshold. Point a scheduled job at it daily.
 */
export const POST = withTenant(async (_req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  const contracts = await prisma.contract.findMany({
    where: { tenantId, type: 'prepay_hours', status: 'active' },
    select: { id: true, name: true, blockMode: true, autoTopUp: true },
  });

  const created: any[] = [];
  const toppedUp: any[] = [];

  for (const c of contracts) {
    if (c.blockMode === 'monthly') {
      const block = await ensureCurrentPeriodBlock(c.id, tenantId);
      if (block) created.push({ contract: c.name, hours: block.hours, amount: block.amount });
    }
    if (c.autoTopUp) {
      const top = await maybeTopUp(c.id, tenantId);
      if (top) toppedUp.push({ contract: c.name, hours: top.hours, amount: top.amount });
    }
  }

  return jsonResponse({
    contractsChecked: contracts.length,
    blocksCreated: created,
    topUps: toppedUp,
  });
}, 'invoices', 'write');
