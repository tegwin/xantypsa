import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const statuses = await prisma.ticketStatus.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return jsonResponse({ items: statuses });
}, 'settings,service_desk', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Status name is required');

  const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!slug) return errorResponse('Invalid status name');

  const status = await prisma.ticketStatus.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      slug,
      color: body.color || '#94a3b8',
      isClosed: body.isClosed ?? false,
      isDefault: body.isDefault ?? false,
      sortOrder: body.sortOrder ?? 99,
    },
  });

  if (status.isDefault) {
    await prisma.ticketStatus.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: status.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(status, 201);
}, 'settings', 'write');
