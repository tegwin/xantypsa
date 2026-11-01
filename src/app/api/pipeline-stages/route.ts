import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const stages = await prisma.pipelineStage.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return jsonResponse({ items: stages });
}, 'crm', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Stage name is required');
  if (body.isWon && body.isLost) return errorResponse('A stage cannot be both won and lost');

  const slug = (body.slug || body.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!slug) return errorResponse('Invalid stage name');

  const existing = await prisma.pipelineStage.findFirst({
    where: { tenantId: session.user.tenantId, slug },
  });
  if (existing) return errorResponse('A stage with that name already exists');

  const stage = await prisma.pipelineStage.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      slug,
      color: body.color || '#3b82f6',
      probability: Math.min(100, Math.max(0, parseInt(body.probability ?? '0'))),
      isWon: !!body.isWon,
      isLost: !!body.isLost,
      isDefault: !!body.isDefault,
      sortOrder: body.sortOrder ?? 99,
    },
  });

  if (stage.isDefault) {
    await prisma.pipelineStage.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: stage.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(stage, 201);
}, 'crm', 'write');
