import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';

/**
 * The sales funnel: how many opportunities sit in each pipeline stage and what
 * they are worth, in the tenant's own stage order.
 *
 * Won and lost stages are reported separately from the open funnel, because
 * mixing closed deals into the funnel overstates what is still in play.
 */
export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const p = Object.fromEntries(req.nextUrl.searchParams);

  const dateFilter =
    p.from || p.to
      ? {
          createdAt: {
            ...(p.from ? { gte: new Date(p.from) } : {}),
            ...(p.to ? { lte: new Date(p.to) } : {}),
          },
        }
      : {};

  const stages = await prisma.pipelineStage.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  const opportunities = await prisma.opportunity.findMany({
    where: { tenantId, ...dateFilter },
    select: { stage: true, value: true, probability: true, reasonId: true },
  });

  const bucket = (slug: string) => opportunities.filter((o) => o.stage === slug);

  const rows = stages.map((s) => {
    const items = bucket(s.slug);
    const value = items.reduce((a, o) => a + (o.value || 0), 0);
    return {
      slug: s.slug,
      name: s.name,
      color: s.color,
      isWon: s.isWon,
      isLost: s.isLost,
      count: items.length,
      value: Math.round(value * 100) / 100,
      weightedValue:
        Math.round(items.reduce((a, o) => a + (o.value || 0) * (o.probability || 0) / 100, 0) * 100) / 100,
    };
  });

  const open = rows.filter((r) => !r.isWon && !r.isLost);
  const won = rows.filter((r) => r.isWon);
  const lost = rows.filter((r) => r.isLost);

  const sum = (rs: typeof rows, key: 'count' | 'value' | 'weightedValue') =>
    Math.round(rs.reduce((a, r) => a + r[key], 0) * 100) / 100;

  const wonCount = sum(won, 'count');
  const lostCount = sum(lost, 'count');
  const decided = wonCount + lostCount;

  // Why deals were won and lost, for the tenants that record reasons.
  const reasons = await prisma.winLossReason.findMany({
    where: { tenantId },
    select: { id: true, name: true, type: true },
  });
  const reasonBreakdown = reasons
    .map((r) => ({
      ...r,
      count: opportunities.filter((o) => o.reasonId === r.id).length,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  return jsonResponse({
    stages: rows,
    funnel: open,
    totals: {
      openCount: sum(open, 'count'),
      openValue: sum(open, 'value'),
      weightedValue: sum(open, 'weightedValue'),
      wonCount,
      wonValue: sum(won, 'value'),
      lostCount,
      lostValue: sum(lost, 'value'),
      winRatePercent: decided > 0 ? Math.round((wonCount / decided) * 10000) / 100 : 0,
    },
    reasons: reasonBreakdown,
  });
}, 'crm', 'read');
