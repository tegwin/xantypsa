import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const template = await prisma.quoteTemplate.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!template) return errorResponse('Template not found', 404);

  const updated = await prisma.quoteTemplate.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.items !== undefined && { items: body.items }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.terms !== undefined && { terms: body.terms }),
    },
  });
  return jsonResponse(updated);
}, 'quotes', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const template = await prisma.quoteTemplate.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!template) return errorResponse('Template not found', 404);
  await prisma.quoteTemplate.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'quotes', 'delete');
