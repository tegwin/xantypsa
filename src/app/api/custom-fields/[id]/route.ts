import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const field = await prisma.customField.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!field) return errorResponse('Custom field not found', 404);

  const updated = await prisma.customField.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.fieldType !== undefined && { fieldType: body.fieldType }),
      ...(body.options !== undefined && { options: body.options }),
      ...(body.required !== undefined && { required: body.required }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const field = await prisma.customField.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!field) return errorResponse('Custom field not found', 404);

  await prisma.customField.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'settings', 'delete');
