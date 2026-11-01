import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';
import DashboardClient from './DashboardClient';

async function getDashboardData(tenantId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    openTickets,
    ticketsThisMonth,
    activeProjects,
    _unusedRevenue,
    overdueInvoices,
    opportunities,
    recentTickets,
    contacts,
    companies,
  ] = await Promise.all([
    prisma.ticket.count({ where: { tenantId, status: { in: ['new', 'open', 'pending', 'waiting'] } } }),
    prisma.ticket.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.project.count({ where: { tenantId, status: 'active' } }),
    prisma.invoice.aggregate({ where: { tenantId, status: 'paid' }, _sum: { total: true } }),
    prisma.invoice.count({ where: { tenantId, status: 'overdue' } }),
    prisma.opportunity.findMany({
      where: { tenantId, stage: { notIn: ['won', 'lost'] } },
      select: { id: true, title: true, value: true, stage: true, probability: true },
      orderBy: { value: 'desc' },
      take: 10,
    }),
    prisma.ticket.findMany({
      where: { tenantId },
      include: { company: { select: { name: true } }, assignedTo: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.contact.count({ where: { tenantId } }),
    prisma.company.count({ where: { tenantId } }),
  ]);

  // Get ticket stats by status for chart
  const ticketsByStatus = await prisma.ticket.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: { id: true },
  });

  // Revenue by month (last 6 months) - include sent + paid invoices (not just paid)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const billedInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: { in: ['sent', 'paid', 'partial'] }, issueDate: { gte: sixMonthsAgo } },
    select: { total: true, issueDate: true, contractId: true },
  });

  // Also count billed time entries for T&M breakdown
  const billedTimeEntries = await prisma.timeEntry.findMany({
    where: { tenantId, billed: true, date: { gte: sixMonthsAgo } },
    select: { billedAmount: true, date: true, chargeType: true },
  });

  const revenueByMonth: Record<string, { month: string; invoiced: number; tam: number; contract: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    revenueByMonth[key] = { month: key, invoiced: 0, tam: 0, contract: 0 };
  }
  for (const inv of billedInvoices) {
    const key = inv.issueDate.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    if (revenueByMonth[key]) {
      revenueByMonth[key].invoiced += inv.total;
      if (inv.contractId) {
        revenueByMonth[key].contract += inv.total;
      } else {
        revenueByMonth[key].tam += inv.total;
      }
    }
  }

  // Active contracts summary
  const activeContracts = await prisma.contract.findMany({
    where: { tenantId, status: 'active' },
    select: { id: true, name: true, type: true, totalHours: true, hoursUsed: true, monthlyFee: true, fixedPrice: true, value: true },
  });

  const contractSummary = {
    total: activeContracts.length,
    blocks: activeContracts.filter(c => c.type === 'prepay_hours').map(c => ({
      id: c.id, name: c.name, totalHours: c.totalHours, hoursUsed: c.hoursUsed,
      remaining: (c.totalHours || 0) - (c.hoursUsed || 0),
      pct: c.totalHours ? ((c.hoursUsed || 0) / c.totalHours * 100) : 0,
    })),
    managedValue: activeContracts.filter(c => c.type === 'managed_service').reduce((s, c) => s + (c.monthlyFee || c.value || 0), 0),
  };

  const pipelineValue = opportunities.reduce((acc, d) => acc + d.value, 0);
  const weightedPipeline = opportunities.reduce((acc, d) => acc + d.value * (d.probability / 100), 0);

  return {
    stats: {
      openTickets,
      ticketsThisMonth,
      activeProjects,
      totalRevenue: billedInvoices.reduce((s, inv) => s + inv.total, 0),
      overdueInvoices,
      pipelineValue,
      weightedPipeline,
      contacts,
      companies,
    },
    ticketsByStatus: ticketsByStatus.map((t) => ({ status: t.status, count: t._count.id })),
    revenueByMonth: Object.values(revenueByMonth),
    contractSummary,
    recentTickets: recentTickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      status: t.status,
      priority: t.priority,
      company: t.company?.name || 'No company',
      assignedTo: t.assignedTo?.name || 'Unassigned',
      createdAt: t.createdAt.toISOString(),
    })),
    opportunities: opportunities.map((d) => ({
      id: d.id,
      title: d.title,
      value: d.value,
      stage: d.stage,
      probability: d.probability,
    })),
  };
}

export default async function DashboardPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;

  const data = await getDashboardData(session.user.tenantId);

  return <DashboardClient data={data} currency="GBP" userName={session.user.name} />;
}
