import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  const idx = segments.indexOf('users');
  return idx >= 0 && idx + 1 < segments.length ? segments[idx + 1] : '';
}

/** Only a user who belongs to this tenant may be read or changed through it. */
async function assertMember(userId: string, tenantId: string) {
  const membership = await prisma.tenantUser.findFirst({
    where: { userId, tenantId },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, phone: true, avatar: true,
          mfaRequired: true, isActive: true, isSuperAdmin: true,
          lastLogin: true, createdAt: true,
        },
      },
      role: { select: { id: true, name: true } },
    },
  });
  return membership;
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const membership = await assertMember(id, session.user.tenantId);
  if (!membership) return errorResponse('User not found', 404);

  // Roles for the picker, so the edit screen needs a single request.
  const roles = await prisma.role.findMany({
    where: { tenantId: session.user.tenantId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return jsonResponse({
    ...membership.user,
    roleId: membership.roleId,
    // Cost is per membership, so a user working for two tenants has one rate each.
    costRate: membership.costRate,
    roleName: membership.role?.name ?? null,
    isOwner: membership.isOwner,
    roles,
  });
}, 'settings', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const tenantId = session.user.tenantId;
  const body = await req.json();

  const membership = await assertMember(id, tenantId);
  if (!membership) return errorResponse('User not found', 404);

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.mfaRequired !== undefined) data.mfaRequired = Boolean(body.mfaRequired);

  // Cost rates are commercially sensitive - close to salary information - so
  // they are restricted to tenant owners and super admins rather than anyone
  // with settings access.
  if (body.costRate !== undefined) {
    if (!session.user.isSuperAdmin && !membership.isOwner && !session.user.permissions?.includes('settings:manage')) {
      const actor = await prisma.tenantUser.findFirst({
        where: { userId: session.user.id, tenantId },
        select: { isOwner: true },
      });
      if (!actor?.isOwner) {
        return errorResponse('Only an owner or admin can set cost rates', 403);
      }
    }
    const parsed = body.costRate === null || body.costRate === '' ? null : parseFloat(body.costRate);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
      return errorResponse('Cost rate must be a positive number');
    }
    // Written to the membership, not the user.
    await prisma.tenantUser.update({ where: { id: membership.id }, data: { costRate: parsed } });
  }

  if (body.roleId) {
    const role = await prisma.role.findFirst({ where: { id: body.roleId, tenantId } });
    if (!role) return errorResponse('Role not found', 404);
    await prisma.tenantUser.update({ where: { id: membership.id }, data: { roleId: body.roleId } });
  }

  const updated = Object.keys(data).length
    ? await prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, isActive: true },
      })
    : membership.user;

  return jsonResponse(updated);
}, 'settings', 'write');
