import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import TicketsClient from './TicketsClient';

export default async function TicketsPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;

  const tenantId = session.user.tenantId;

  const [tickets, queues, agents, customStatuses, companies] = await Promise.all([
    prisma.ticket.findMany({
      where: { tenantId },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        assignedTo: { select: { name: true } },
        queue: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.ticketQueue.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.tenantUser.findMany({
      where: { tenantId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.ticketStatus.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.company.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <TicketsClient
      tickets={tickets.map((t) => ({
        id: t.id, ticketNumber: t.ticketNumber, title: t.title, status: t.status, priority: t.priority,
        type: t.type, category: t.category || '', company: t.company?.name || '',
        contact: t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : '',
        assignedTo: t.assignedTo?.name || 'Unassigned', queue: t.queue?.name || '',
        queueId: t.queueId || '', source: t.source, createdAt: t.createdAt.toISOString(), timeSpent: t.timeSpent,
      }))}
      queues={queues.map(q => ({ id: q.id, name: q.name }))}
      agents={agents.map(a => ({ id: a.user.id, name: a.user.name }))}
      companies={companies}
      customStatuses={customStatuses.length > 0 ? customStatuses.map(s => ({
        slug: s.slug, name: s.name, isClosed: s.isClosed, color: s.color,
      })) : undefined}
    />
  );
}
