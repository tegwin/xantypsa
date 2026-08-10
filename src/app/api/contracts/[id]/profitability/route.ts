import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { contractProfitability } from '@/lib/costing';
import { prisma } from '@/lib/prisma';

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  const idx = segments.indexOf('contracts');
  return idx >= 0 && idx + 1 < segments.length ? segments[idx + 1] : '';
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const contractId = extractId(req);
  const tenantId = session.user.tenantId;
  const { searchParams } = req.nextUrl;

  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined;
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined;

  try {
    const result = await contractProfitability(contractId, tenantId, { from, to });

    // Per-engineer breakdown, so an unprofitable contract can be traced to
    // where the time actually went.
    const entries = await prisma.timeEntry.findMany({
      where: {
        contractId,
        tenantId,
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      select: {
        hours: true,
        internalCost: true,
        userId: true,
        user: { select: { id: true, name: true } },
      },
    });

    const byEngineer = Object.values(
      entries.reduce((acc: any, e) => {
        const id = e.user?.id ?? 'unknown';
        acc[id] ??= {
          userId: id,
          name: e.user?.name ?? 'Unknown',
          hours: 0,
          cost: 0,
        };
        acc[id].hours += e.hours ?? 0;
        acc[id].cost += e.internalCost ?? 0;
        return acc;
      }, {})
    );

    return jsonResponse({ ...result, byEngineer });
  } catch (err: any) {
    if (err.message === 'Contract not found') return errorResponse('Contract not found', 404);
    throw err;
  }
}, 'reports', 'read');
