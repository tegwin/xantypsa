// ============================================================
// Which queues a person works
// ============================================================
// The same membership as /api/ticket-queues/<id>/members, seen from the
// person's side, so they can be put in a queue from their own page.

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

function userIdFrom(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split('/');
  return parts[parts.indexOf('users') + 1];
}

/** The person must belong to this tenant before anything is said about them. */
async function requireMember(req: NextRequest, tenantId: string) {
  const userId = userIdFrom(req);
  const member = await prisma.tenantUser.findFirst({
    where: { tenantId, userId },
    select: { userId: true },
  });
  return member ? userId : null;
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const userId = await requireMember(req, tenantId);
  if (!userId) return errorResponse('User not found', 404);

  // Every queue, each saying whether this person is in it, so the tab can
  // show the whole picture rather than only what they already have.
  const queues = await prisma.ticketQueue.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true, name: true, description: true,
      members: { select: { userId: true } },
      _count: { select: { tickets: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return jsonResponse({
    items: queues.map((q) => ({
      id: q.id,
      name: q.name,
      description: q.description,
      ticketCount: q._count.tickets,
      isMember: q.members.some((m) => m.userId === userId),
      // A queue nobody has been put in is visible to everybody.
      isOpenToEveryone: q.members.length === 0,
      memberCount: q.members.length,
    })),
  });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const userId = await requireMember(req, tenantId);
  if (!userId) return errorResponse('User not found', 404);

  const { queueId } = await req.json().catch(() => ({}));
  if (!queueId) return errorResponse('Choose a queue', 400);

  const queue = await prisma.ticketQueue.findFirst({
    where: { id: String(queueId), tenantId },
    select: { id: true },
  });
  if (!queue) return errorResponse('Queue not found', 404);

  await prisma.ticketQueueMember.upsert({
    where: { queueId_userId: { queueId: queue.id, userId } },
    create: { tenantId, queueId: queue.id, userId },
    update: {},
  });
  return jsonResponse({ ok: true }, 201);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const userId = await requireMember(req, tenantId);
  if (!userId) return errorResponse('User not found', 404);

  const queueId = req.nextUrl.searchParams.get('queueId');
  if (!queueId) return errorResponse('Say which queue', 400);

  const removed = await prisma.ticketQueueMember.deleteMany({ where: { tenantId, queueId, userId } });
  if (removed.count === 0) return errorResponse('They are not in that queue', 404);
  return jsonResponse({ ok: true });
}, 'settings', 'write');
