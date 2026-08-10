import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType') || '';
  const entityId = searchParams.get('entityId') || '';
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const items = await prisma.crmNote.findMany({
    where,
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return jsonResponse({ items });
}, 'crm', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.entityType || !body.entityId) return errorResponse('entityType and entityId are required');
  if (!body.content) return errorResponse('Content is required');

  const note = await prisma.crmNote.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      entityType: body.entityType,
      entityId: body.entityId,
      content: body.content,
      type: body.type || 'note',
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return jsonResponse(note, 201);
}, 'crm', 'write');
