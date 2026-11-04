// ============================================================
// GET /api/invoices/stats - the figures behind the status tiles
// ============================================================

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = withTenant(async (_req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  // One pass over the invoices, then bucketed in memory. Six separate counts
  // would be six round trips to a database that is a network hop away.
  const rows = await prisma.invoice.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: { id: true },
    _sum: { total: true, amountDue: true },
  });

  const get = (statuses: string[]) => {
    const matching = rows.filter((r) => statuses.includes(r.status));
    return {
      count: matching.reduce((t, r) => t + r._count.id, 0),
      total: Math.round(matching.reduce((t, r) => t + (r._sum.total ?? 0), 0) * 100) / 100,
      outstanding: Math.round(matching.reduce((t, r) => t + (r._sum.amountDue ?? 0), 0) * 100) / 100,
    };
  };

  return jsonResponse({
    // The filter each tile applies. An empty string means no filter.
    tiles: [
      { key: '', label: 'All', ...get(rows.map((r) => r.status)) },
      { key: 'paid', label: 'Paid', ...get(['paid']) },
      { key: 'partial', label: 'Partially paid', ...get(['partial']) },
      { key: 'unpaid', label: 'Unpaid', ...get(['sent', 'viewed']) },
      { key: 'draft', label: 'Not sent', ...get(['draft']) },
      { key: 'overdue', label: 'Overdue', ...get(['overdue']) },
      { key: 'void', label: 'Void', ...get(['void', 'cancelled', 'refunded']) },
    ],
  });
}, 'invoices', 'read');
