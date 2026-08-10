import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  const [
    openTickets, totalTickets,
    activeCompanies, totalCompanies,
    activeProjects,
    outstandingInvoices,
    paidInvoices,
    pendingQuotes,
    recentTickets,
    recentActivity,
  ] = await Promise.all([
    prisma.ticket.count({ where: { tenantId, status: { in: ['new', 'open', 'pending'] } } }),
    prisma.ticket.count({ where: { tenantId } }),
    prisma.company.count({ where: { tenantId, isActive: true } }),
    prisma.company.count({ where: { tenantId } }),
    prisma.project.count({ where: { tenantId, status: { in: ['planning', 'active'] } } }),
    prisma.invoice.aggregate({ where: { tenantId, status: { in: ['sent', 'overdue', 'partial'] } }, _sum: { total: true }, _count: true }),
    prisma.invoice.aggregate({ where: { tenantId, status: 'paid' }, _sum: { total: true } }),
    prisma.quote.aggregate({ where: { tenantId, status: { in: ['draft', 'sent'] } }, _sum: { total: true }, _count: true }),
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
    where: { tenantId, status: { in: ['new', 'open', 'pending'] } },
    _count: true,
  });

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
    },
    ticketsByPriority: ticketsByPriority.map(t => ({ priority: t.priority, count: t._count })),
    recentTickets,
    recentActivity,
  });
});
