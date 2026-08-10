import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const note = await prisma.crmNote.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!note) return errorResponse('Note not found', 404);

  const updated = await prisma.crmNote.update({
    where: { id },
    data: {
      ...(body.content !== undefined && { content: body.content }),
      ...(body.isPinned !== undefined && { isPinned: body.isPinned }),
      ...(body.type !== undefined && { type: body.type }),
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return jsonResponse(updated);
}, 'crm', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const note = await prisma.crmNote.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!note) return errorResponse('Note not found', 404);

  await prisma.crmNote.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'crm', 'delete');
