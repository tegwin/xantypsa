import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  const quotes = await prisma.quote.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { id: true, name: true } },
    },
  });

  const statuses = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'];
  const columns: Record<string, { count: number; totalValue: number; quotes: any[] }> = {};

  for (const status of statuses) {
    const statusQuotes = quotes.filter(q => q.status === status);
    columns[status] = {
      count: statusQuotes.length,
      totalValue: statusQuotes.reduce((sum, q) => sum + q.total, 0),
      quotes: statusQuotes.map(q => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        title: q.title,
        total: q.total,
        currency: q.currency,
        validUntil: q.validUntil,
        createdAt: q.createdAt,
        company: q.company,
      })),
    };
  }

  return jsonResponse({ columns });
}, 'quotes', 'read');
