import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'overview';

  if (type === 'overview') {
    const [tickets, companies, projects, invoices, revenue, timeEntries] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      prisma.company.count({ where: { tenantId, isActive: true } }),
      prisma.project.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      prisma.invoice.aggregate({ where: { tenantId }, _sum: { total: true, amountPaid: true }, _count: true }),
      prisma.invoice.groupBy({
        by: ['createdAt'],
        where: { tenantId, createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
        _sum: { total: true, amountPaid: true },
      }),
      prisma.timeEntry.aggregate({ where: { tenantId }, _sum: { hours: true } }),
    ]);
    return jsonResponse({ tickets, companies, projects, invoices, revenue, timeEntries });
  }

  if (type === 'revenue') {
    const months = parseInt(searchParams.get('months') || '12');
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const invoices = await prisma.invoice.findMany({
      where: { tenantId, createdAt: { gte: startDate } },
      select: { total: true, amountPaid: true, status: true, createdAt: true, company: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const monthlyRevenue: Record<string, { invoiced: number; paid: number }> = {};
    invoices.forEach(inv => {
      const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyRevenue[key]) monthlyRevenue[key] = { invoiced: 0, paid: 0 };
      monthlyRevenue[key].invoiced += inv.total;
      monthlyRevenue[key].paid += inv.amountPaid;
    });

    return jsonResponse({ monthlyRevenue, invoices });
  }

  if (type === 'tickets') {
    const [byStatus, byPriority, byType, avgResolution] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
      prisma.ticket.groupBy({ by: ['priority'], where: { tenantId }, _count: true }),
      prisma.ticket.groupBy({ by: ['type'], where: { tenantId }, _count: true }),
      prisma.ticket.aggregate({
        where: { tenantId, resolvedAt: { not: null } },
        _avg: { timeSpent: true },
      }),
    ]);
    return jsonResponse({ byStatus, byPriority, byType, avgResolution });
  }

  if (type === 'utilization') {
    const users = await prisma.user.findMany({
      // User has no tenantId; membership is via the TenantUser join table.
      where: { tenants: { some: { tenantId } }, isActive: true },
      select: {
        id: true, name: true,
        timeEntries: {
          where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          select: { hours: true, billable: true },
        },
      },
    });

    const utilization = users.map(u => ({
      name: u.name,
      totalHours: u.timeEntries.reduce((s, e) => s + e.hours, 0),
      billableHours: u.timeEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0),
      nonBillableHours: u.timeEntries.filter(e => !e.billable).reduce((s, e) => s + e.hours, 0),
    }));

    return jsonResponse({ utilization });
  }

  return jsonResponse({ error: 'Unknown report type' });
}, 'reports', 'read');
