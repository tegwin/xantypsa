import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      user: { select: { id: true, name: true } },
    },
  });
  if (!document) return errorResponse('Document not found', 404);

  return jsonResponse(document);
}, 'crm', 'read');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const document = await prisma.document.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!document) return errorResponse('Document not found', 404);

  // TODO: Delete actual file from storage when implemented
  await prisma.document.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'crm', 'delete');
