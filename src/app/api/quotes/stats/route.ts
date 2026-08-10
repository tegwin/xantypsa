import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  const quotes = await prisma.quote.findMany({
    where: { tenantId },
    select: { id: true, status: true, total: true, companyId: true, createdAt: true },
  });

  const total = quotes.length;
  const accepted = quotes.filter(q => q.status === 'accepted').length;
  const rejected = quotes.filter(q => ['rejected', 'declined'].includes(q.status)).length;
  const sent = quotes.filter(q => q.status === 'sent').length;
  const draft = quotes.filter(q => q.status === 'draft').length;
  const totalValue = quotes.reduce((s, q) => s + q.total, 0);
  const acceptedValue = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.total, 0);
  const conversionRate = (accepted + rejected) > 0 ? Math.round((accepted / (accepted + rejected)) * 100) : 0;

  // Pipeline by status
  const statuses = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'];
  const pipeline = statuses.map(status => ({
    status,
    count: quotes.filter(q => q.status === status).length,
    totalValue: quotes.filter(q => q.status === status).reduce((s, q) => s + q.total, 0),
  }));

  // Top customers
  const companyMap = new Map<string, { companyId: string; count: number; totalValue: number }>();
  quotes.forEach(q => {
    if (!q.companyId) return;
    const existing = companyMap.get(q.companyId) || { companyId: q.companyId, count: 0, totalValue: 0 };
    existing.count++;
    existing.totalValue += q.total;
    companyMap.set(q.companyId, existing);
  });
  const topCustomerIds = Array.from(companyMap.values()).sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);

  const companies = topCustomerIds.length > 0 ? await prisma.company.findMany({
    where: { id: { in: topCustomerIds.map(c => c.companyId) } },
    select: { id: true, name: true },
  }) : [];

  const topCustomers = topCustomerIds.map(c => ({
    ...c,
    companyName: companies.find(co => co.id === c.companyId)?.name || 'Unknown',
  }));

  // Monthly trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentQuotes = quotes.filter(q => new Date(q.createdAt) >= sixMonthsAgo);

  const monthlyMap = new Map<string, { month: string; count: number; value: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, { month: key, count: 0, value: 0 });
  }
  recentQuotes.forEach(q => {
    const d = new Date(q.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthlyMap.get(key);
    if (existing) { existing.count++; existing.value += q.total; }
  });

  return jsonResponse({
    total, accepted, rejected, sent, draft,
    totalValue, acceptedValue, conversionRate,
    pipeline, topCustomers,
    monthlyTrend: Array.from(monthlyMap.values()),
  });
}, 'quotes', 'read');
