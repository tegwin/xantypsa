import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';
import DashboardClient from './DashboardClient';
import { closedStatusSlugs } from '@/lib/ticketStatus';

async function getDashboardData(tenantId: string) {
  const now = new Date();

  // Open means "not in a status this tenant has flagged as closed". The old
  // hard coded list ignored every custom status.
  // Stages flagged won or lost are out of the pipeline. Falling back to the
  // two default names for a tenant that has not defined its own.
  // Both of these feed the queries below, so they go first, but in parallel
  // with each other: the database is a round trip away and they are unrelated.
  const [closedSlugs, terminalStages] = await Promise.all([
    closedStatusSlugs(tenantId),
    prisma.pipelineStage.findMany({
      where: { tenantId, OR: [{ isWon: true }, { isLost: true }] },
      select: { slug: true },
    }),
  ]);
  const closedStages = terminalStages.length > 0
    ? terminalStages.map((s) => s.slug)
    : ['won', 'lost'];
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [
    openTickets,
    ticketsThisMonth,
    activeProjects,
    allInvoiced,
    overdueInvoices,
    opportunities,
    recentTickets,
    contacts,
    companies,
    ticketsByStatus,
    billedInvoices,
    billedTimeEntries,
    activeContracts,
  ] = await Promise.all([
    prisma.ticket.count({ where: { tenantId, status: { notIn: closedSlugs } } }),
    prisma.ticket.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.project.count({ where: { tenantId, status: { in: ['planning', 'active'] } } }),
    // Everything ever invoiced, which is every invoice that was not cancelled.
    // Counting only paid ones showed zero until somebody settled a bill.
    prisma.invoice.aggregate({ where: { tenantId, status: { not: 'cancelled' } }, _sum: { total: true } }),
    prisma.invoice.count({ where: { tenantId, status: 'overdue' } }),
    prisma.opportunity.findMany({
      where: { tenantId, stage: { notIn: closedStages } },
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
    // Ticket stats by status, for the chart.
    prisma.ticket.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    }),
    // Revenue by month over the last six. Sent and partial count as billed,
    // not only paid, or the figure reads zero until somebody settles a bill.
    prisma.invoice.findMany({
      where: { tenantId, status: { in: ['sent', 'paid', 'partial'] }, issueDate: { gte: sixMonthsAgo } },
      select: { total: true, issueDate: true, contractId: true },
    }),
    // Billed time entries, for the T&M breakdown.
    prisma.timeEntry.findMany({
      where: { tenantId, billed: true, date: { gte: sixMonthsAgo } },
      select: { billedAmount: true, date: true, chargeType: true },
    }),
    prisma.contract.findMany({
      where: { tenantId, status: 'active' },
      select: { id: true, name: true, type: true, totalHours: true, hoursUsed: true, monthlyFee: true, fixedPrice: true, value: true },
    }),
  ]);

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
      totalRevenue: allInvoiced._sum.total || 0,
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

/**
 * May this person see what the business earns?
 *
 * Revenue, the pipeline and contract values are commercial, not operational.
 * A technician needs none of them to work a ticket, so they are decided here
 * and the figures are never sent to the browser rather than being hidden once
 * they arrive.
 */
function canSeeMoney(session: any): boolean {
  if (session?.user?.isSuperAdmin) return true;
  const perms: string[] = session?.user?.permissions || [];
  return ['invoices', 'quotes'].some(
    (m) => perms.includes(`${m}:view`) || perms.includes(`${m}:manage`)
  );
}

export default async function DashboardPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;

  const data = await getDashboardData(session.user.tenantId);
  const showMoney = canSeeMoney(session);

  return (
    <DashboardClient
      data={showMoney ? data : withoutMoney(data)}
      showMoney={showMoney}
      currency="GBP"
      userName={session.user.name}
    />
  );
}

/** The same shape, with every figure stripped out of it. */
function withoutMoney(data: Awaited<ReturnType<typeof getDashboardData>>) {
  return {
    ...data,
    // Pre-pay blocks stay: hours left on a contract is operational, and an
    // engineer needs to know before logging two more against it.
    stats: { ...data.stats, totalRevenue: 0, pipelineValue: 0, weightedPipeline: 0 },
    revenueByMonth: [],
    contractSummary: { ...data.contractSummary, managedValue: 0 },
    opportunities: data.opportunities.map((o) => ({ ...o, value: 0 })),
  };
}
