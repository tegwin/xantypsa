import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonResponse, errorResponse } from '@/lib/api';
import { getAppSession } from '@/lib/session';
import { IMPERSONATION_COOKIE, COOKIE_OPTIONS, buildToken } from '@/lib/impersonation';

/**
 * Start impersonating a user.
 *
 * Not wrapped in withTenant: that resolves the *effective* session, which would
 * already be the impersonated user. This needs the real one so an impersonated
 * session cannot chain into impersonating somebody else.
 */
export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (!session) return errorResponse('Unauthorized', 401);

  // Already impersonating - stop first. Prevents hopping between identities
  // while obscuring who started it.
  if (session.impersonatedBy) {
    return errorResponse('Already impersonating. Stop the current session first.', 400);
  }

  const actorId = session.user.id;
  const tenantId = session.user.tenantId;

  const actor = await prisma.tenantUser.findFirst({
    where: { userId: actorId, tenantId },
    select: { isOwner: true },
  });

  if (!session.user.isSuperAdmin && !actor?.isOwner) {
    return errorResponse('Only an owner or super admin can impersonate', 403);
  }

  const { userId } = await req.json();
  if (!userId) return errorResponse('userId is required');
  if (userId === actorId) return errorResponse('You are already yourself');

  // Must be a real, active member of the same tenant.
  const target = await prisma.tenantUser.findFirst({
    where: { userId, tenantId },
    include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
  });

  if (!target || !target.user.isActive) {
    return errorResponse('User not found in this tenant', 404);
  }

  // Audit before granting - if the write fails, the impersonation does not happen.
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: actorId,
      action: 'impersonate.start',
      entityType: 'User',
      entityId: userId,
      changes: {
        actor: { id: actorId, email: session.user.email },
        target: { id: target.user.id, email: target.user.email },
      },
    },
  });

  const response = NextResponse.json({
    success: true,
    impersonating: { id: target.user.id, name: target.user.name, email: target.user.email },
  });
  response.cookies.set(IMPERSONATION_COOKIE, buildToken(userId, actorId), COOKIE_OPTIONS);
  return response;
}

/** Stop impersonating and return to your own identity. */
export async function DELETE() {
  const session = await getAppSession();

  if (session?.impersonatedBy) {
    await prisma.auditLog
      .create({
        data: {
          tenantId: session.user.tenantId,
          userId: session.impersonatedBy.id,
          action: 'impersonate.stop',
          entityType: 'User',
          entityId: session.user.id,
          changes: {
            actor: { id: session.impersonatedBy.id, email: session.impersonatedBy.email },
            target: { id: session.user.id, email: session.user.email },
          },
        },
      })
      // Never block someone from getting *out* of impersonation.
      .catch(() => undefined);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(IMPERSONATION_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  return response;
}
