// ============================================================
// Who can see which queue's tickets
// ============================================================

import { prisma } from './prisma';

/**
 * Someone who sees every queue regardless of membership.
 *
 * Super admins, plus anyone whose role carries service_desk:manage.
 * Without this an administrator would lose sight of a queue simply by not
 * being one of the engineers working it.
 */
export function seesAllQueues(session: any): boolean {
  if (session?.user?.isSuperAdmin) return true;
  const perms: string[] = session?.user?.permissions ?? [];
  return perms.includes('service_desk:manage');
}

/**
 * A Prisma filter limiting tickets to the queues this user may see.
 *
 * The rules, in order:
 *  - an administrator sees everything
 *  - a queue with no members is open to everyone, so adding this feature did
 *    not hide every existing ticket overnight
 *  - otherwise you see a queue only if you are in it
 *  - you always see a ticket assigned to you, and tickets in no queue at all
 *
 * Returns null when no filter is needed, which the caller spreads as nothing.
 */
export async function visibleTicketFilter(session: any): Promise<Record<string, any> | null> {
  if (seesAllQueues(session)) return null;

  const tenantId = session.user.tenantId;
  const userId = session.user.id;

  // Queues that have somebody in them are the only restricted ones.
  const [restricted, mine] = await Promise.all([
    prisma.ticketQueueMember.findMany({
      where: { tenantId },
      select: { queueId: true },
      distinct: ['queueId'],
    }),
    prisma.ticketQueueMember.findMany({
      where: { tenantId, userId },
      select: { queueId: true },
    }),
  ]);

  const restrictedIds = restricted.map((r) => r.queueId);
  const myIds = new Set(mine.map((m) => m.queueId));
  const closedToMe = restrictedIds.filter((id) => !myIds.has(id));

  if (closedToMe.length === 0) return null;

  return {
    OR: [
      { queueId: null },
      { queueId: { notIn: closedToMe } },
      // Never hide somebody's own work from them, wherever it was put.
      { assignedToId: userId },
    ],
  };
}
