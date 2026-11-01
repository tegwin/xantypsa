import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const type = req.nextUrl.searchParams.get('type');
  const reasons = await prisma.winLossReason.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(type ? { type } : {}),
    },
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
  return jsonResponse({ items: reasons });
}, 'crm', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Reason is required');
  if (body.type !== 'win' && body.type !== 'loss') {
    return errorResponse("Type must be 'win' or 'loss'");
  }

  const existing = await prisma.winLossReason.findFirst({
    where: { tenantId: session.user.tenantId, type: body.type, name: body.name },
  });
  if (existing) return errorResponse('That reason already exists');

  const reason = await prisma.winLossReason.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      type: body.type,
      sortOrder: body.sortOrder ?? 99,
    },
  });
  return jsonResponse(reason, 201);
}, 'crm', 'write');
