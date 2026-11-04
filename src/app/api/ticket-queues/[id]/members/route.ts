// ============================================================
// Who works a queue
// ============================================================
// A queue with no members is open to everyone; adding the first member makes
// it private to its members (and to administrators).

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

function queueIdFrom(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split('/');
  return parts[parts.indexOf('ticket-queues') + 1];
}

async function requireQueue(req: NextRequest, tenantId: string) {
  return prisma.ticketQueue.findFirst({
    where: { id: queueIdFrom(req), tenantId },
    select: { id: true, name: true },
  });
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const queue = await requireQueue(req, tenantId);
  if (!queue) return errorResponse('Queue not found', 404);

  const members = await prisma.ticketQueueMember.findMany({
    where: { queueId: queue.id, tenantId },
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return jsonResponse({
    queue,
    members,
    // Said plainly, because "no members" meaning "everyone" is not obvious.
    isOpenToEveryone: members.length === 0,
  });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const queue = await requireQueue(req, tenantId);
  if (!queue) return errorResponse('Queue not found', 404);

  const { userId } = await req.json().catch(() => ({}));
  if (!userId) return errorResponse('Choose someone to add', 400);

  // Must be a member of this tenant, or one tenant could add another's user.
  const belongs = await prisma.tenantUser.findFirst({
    where: { tenantId, userId: String(userId) },
    select: { userId: true },
  });
  if (!belongs) return errorResponse('That person is not in this organisation', 400);

  const member = await prisma.ticketQueueMember.upsert({
    where: { queueId_userId: { queueId: queue.id, userId: String(userId) } },
    create: { tenantId, queueId: queue.id, userId: String(userId) },
    update: {},
    select: { id: true, user: { select: { id: true, name: true, email: true } } },
  });

  return jsonResponse(member, 201);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const queue = await requireQueue(req, tenantId);
  if (!queue) return errorResponse('Queue not found', 404);

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return errorResponse('Say which person to remove', 400);

  const removed = await prisma.ticketQueueMember.deleteMany({
    where: { tenantId, queueId: queue.id, userId },
  });
  if (removed.count === 0) return errorResponse('They are not in this queue', 404);

  const left = await prisma.ticketQueueMember.count({ where: { queueId: queue.id, tenantId } });
  return jsonResponse({
    ok: true,
    // Removing the last member opens the queue up again, which is worth saying.
    isOpenToEveryone: left === 0,
  });
}, 'settings', 'write');
