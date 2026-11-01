import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';
import {
  contractProfitability,
  timeAndMaterialsProfitability,
  breakEvenHours,
} from '@/lib/costing';

/**
 * Profitability across the business: time and materials in one block, then a
 * row per active contract.
 *
 * Every figure is revenue minus every cost we know about, which is the burden
 * rate of the engineers who did the work plus the wholesale cost of anything
 * resold on the contract.
 */
export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const p = Object.fromEntries(req.nextUrl.searchParams);

  const from = p.from ? new Date(p.from) : undefined;
  const to = p.to ? new Date(p.to) : undefined;

  const tam = await timeAndMaterialsProfitability(tenantId, { from, to });

  const contracts = await prisma.contract.findMany({
    where: { tenantId, status: 'active' },
    select: { id: true, name: true, type: true, company: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  const rows = [];
  for (const c of contracts) {
    const profit = await contractProfitability(c.id, tenantId, { from, to });

    // Break even on this contract's own burden where there is any, otherwise
    // fall back to the business-wide average so a quiet contract still gets a
    // usable figure.
    const burdenPerHour =
      profit.hours > 0 && profit.labourCost > 0
        ? profit.labourCost / profit.hours
        : tam.averageBurden;

    rows.push({
      id: c.id,
      name: c.name,
      type: c.type,
      company: c.company?.name || null,
      ...profit,
      burdenPerHour: Math.round(burdenPerHour * 100) / 100,
      breakEvenHours: breakEvenHours(profit.revenue, profit.serviceCost, burdenPerHour),
    });
  }

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      totalCost: acc.totalCost + r.totalCost,
      profit: acc.profit + r.profit,
      hours: acc.hours + r.hours,
    }),
    { revenue: tam.revenue, totalCost: tam.totalCost, profit: tam.profit, hours: tam.hours },
  );

  return jsonResponse({
    timeAndMaterials: tam,
    contracts: rows,
    totals: {
      ...totals,
      revenue: Math.round(totals.revenue * 100) / 100,
      totalCost: Math.round(totals.totalCost * 100) / 100,
      profit: Math.round(totals.profit * 100) / 100,
      hours: Math.round(totals.hours * 100) / 100,
      marginPercent:
        totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 10000) / 100 : 0,
    },
  });
}, 'reports', 'read');
