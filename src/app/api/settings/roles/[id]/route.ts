import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.url.split('/roles/')[1]?.split('?')[0];
  const role = await prisma.role.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) return errorResponse('Role not found', 404);
  return jsonResponse(role);
}, 'settings', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.url.split('/roles/')[1]?.split('?')[0];
  const role = await prisma.role.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!role) return errorResponse('Role not found', 404);
  if (role.isSystem) return errorResponse('Cannot modify system roles', 403);

  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.permissions !== undefined) data.permissions = body.permissions;

  const updated = await prisma.role.update({
    where: { id },
    data,
    include: { _count: { select: { users: true } } },
  });
  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.url.split('/roles/')[1]?.split('?')[0];
  const role = await prisma.role.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) return errorResponse('Role not found', 404);
  if (role.isSystem) return errorResponse('Cannot delete system roles', 403);
  if (role._count.users > 0) return errorResponse('Cannot delete role with assigned users. Reassign users first.', 400);

  await prisma.role.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'settings', 'write');
