import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const stage = await prisma.pipelineStage.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!stage) return errorResponse('Pipeline stage not found', 404);

  const isWon = body.isWon !== undefined ? !!body.isWon : stage.isWon;
  const isLost = body.isLost !== undefined ? !!body.isLost : stage.isLost;
  if (isWon && isLost) return errorResponse('A stage cannot be both won and lost');

  const updated = await prisma.pipelineStage.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.probability !== undefined && {
        probability: Math.min(100, Math.max(0, parseInt(body.probability))),
      }),
      ...(body.isWon !== undefined && { isWon }),
      ...(body.isLost !== undefined && { isLost }),
      ...(body.isDefault !== undefined && { isDefault: !!body.isDefault }),
      ...(body.isActive !== undefined && { isActive: !!body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: parseInt(body.sortOrder) }),
    },
  });

  if (updated.isDefault) {
    await prisma.pipelineStage.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(updated);
}, 'crm', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const stage = await prisma.pipelineStage.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!stage) return errorResponse('Pipeline stage not found', 404);

  // Opportunities reference a stage by slug, so deleting one that is in use
  // would strand them. Deactivate instead and say so.
  const inUse = await prisma.opportunity.count({
    where: { tenantId: session.user.tenantId, stage: stage.slug },
  });
  if (inUse > 0) {
    await prisma.pipelineStage.update({ where: { id }, data: { isActive: false } });
    return jsonResponse({
      deactivated: true,
      message: `${inUse} opportunit${inUse === 1 ? 'y is' : 'ies are'} in this stage, so it has been deactivated rather than deleted.`,
    });
  }

  await prisma.pipelineStage.delete({ where: { id } });
  return jsonResponse({ deleted: true });
}, 'crm', 'write');
