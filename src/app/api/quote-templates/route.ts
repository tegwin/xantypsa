import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const templates = await prisma.quoteTemplate.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: 'asc' },
  });
  return jsonResponse({ items: templates });
}, 'quotes', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Template name is required');

  const template = await prisma.quoteTemplate.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      description: body.description || null,
      items: body.items || [],
      notes: body.notes || null,
      terms: body.terms || null,
    },
  });
  return jsonResponse(template, 201);
}, 'quotes', 'write');
