import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';
import { closedStatusSlugs } from '@/lib/ticketStatus';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  // Open means "not in a status the tenant has flagged as closed". Hard coding
  // new/open/pending ignored every custom status, so a ticket sitting in
  // "In Progress" was counted as neither open nor closed.
  const closedSlugs = await closedStatusSlugs(tenantId);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    openTickets, totalTickets,
    activeCompanies, totalCompanies,
    activeProjects,
    outstandingInvoices,
    paidInvoices,
    pendingQuotes,
    allInvoiced,
    overdueInvoices,
    ticketsThisMonth,
    openOpportunities,
    recentTickets,
    recentActivity,
  ] = await Promise.all([
    prisma.ticket.count({ where: { tenantId, status: { notIn: closedSlugs } } }),
    prisma.ticket.count({ where: { tenantId } }),
    prisma.company.count({ where: { tenantId, isActive: true } }),
    prisma.company.count({ where: { tenantId } }),
    prisma.project.count({ where: { tenantId, status: { in: ['planning', 'active'] } } }),
    prisma.invoice.aggregate({ where: { tenantId, status: { in: ['sent', 'overdue', 'partial'] } }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { tenantId, status: 'paid' }, _sum: { total: true } }),
    prisma.quote.aggregate({ where: { tenantId, status: { in: ['draft', 'sent'] } }, _sum: { total: true }, _count: true }),
    // Everything ever billed, which is every invoice that was not cancelled.
    prisma.invoice.aggregate({ where: { tenantId, status: { not: 'cancelled' } }, _sum: { total: true } }),
    prisma.invoice.count({ where: { tenantId, status: 'overdue' } }),
    prisma.ticket.count({ where: { tenantId, createdAt: { gte: monthStart } } }),
    // Open opportunities, which is anything not sitting in a won or lost stage.
    prisma.opportunity.findMany({
      where: { tenantId, closedAt: null },
      select: { value: true, probability: true },
    }),
    prisma.ticket.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        company: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
  ]);

  // Tickets by priority
  const ticketsByPriority = await prisma.ticket.groupBy({
    by: ['priority'],
    where: { tenantId, status: { notIn: closedSlugs } },
    _count: true,
  });

  const pipelineValue = openOpportunities.reduce((a, o) => a + (o.value || 0), 0);
  const weightedPipeline = openOpportunities.reduce(
    (a, o) => a + (o.value || 0) * (o.probability || 0) / 100,
    0,
  );

  return jsonResponse({
    stats: {
      openTickets,
      totalTickets,
      activeCompanies,
      totalCompanies,
      activeProjects,
      outstandingAmount: outstandingInvoices._sum.total || 0,
      outstandingCount: outstandingInvoices._count,
      paidAmount: paidInvoices._sum.total || 0,
      pendingQuotesAmount: pendingQuotes._sum.total || 0,
      pendingQuotesCount: pendingQuotes._count,
      // Names the dashboard widgets actually read.
      totalRevenue: allInvoiced._sum.total || 0,
      overdueInvoices,
      ticketsThisMonth,
      pipelineValue: Math.round(pipelineValue * 100) / 100,
      weightedPipeline: Math.round(weightedPipeline * 100) / 100,
    },
    ticketsByPriority: ticketsByPriority.map(t => ({ priority: t.priority, count: t._count })),
    recentTickets,
    recentActivity,
  });
});
