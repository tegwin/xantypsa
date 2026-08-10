import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const existing = await prisma.apiKey.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    return errorResponse('API key not found', 404);
  }

  const data: Record<string, any> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.permissions !== undefined) data.permissions = body.permissions;

  const updated = await prisma.apiKey.update({
    where: { id },
    data,
  });

  return jsonResponse({
    id: updated.id,
    name: updated.name,
    isActive: updated.isActive,
    permissions: updated.permissions,
  });
});

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.apiKey.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    return errorResponse('API key not found', 404);
  }

  await prisma.apiKey.delete({ where: { id } });

  return jsonResponse({ success: true });
});
