import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

const SCOPES = ['none', 'own', 'company'] as const;

function scope(v: any, fallback: string) {
  return SCOPES.includes(v) ? v : fallback;
}

export const GET = withTenant(async (_req: NextRequest, session: any) => {
  const items = await prisma.portalRole.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { contacts: true } } },
  });
  return jsonResponse({ items });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('A role needs a name');

  const existing = await prisma.portalRole.findFirst({
    where: { tenantId: session.user.tenantId, name: body.name },
  });
  if (existing) return errorResponse('A role with that name already exists');

  const role = await prisma.portalRole.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      ticketScope: scope(body.ticketScope, 'own'),
      quoteScope: scope(body.quoteScope, 'none'),
      projectScope: scope(body.projectScope, 'none'),
      invoiceScope: scope(body.invoiceScope, 'none'),
      reportScope: scope(body.reportScope, 'none'),
      showBlocks: !!body.showBlocks,
      canCreateTickets: body.canCreateTickets !== false,
      canReplyTickets: body.canReplyTickets !== false,
      isDefault: !!body.isDefault,
      sortOrder: parseInt(body.sortOrder ?? '99') || 99,
    },
  });

  if (role.isDefault) {
    await prisma.portalRole.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: role.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(role, 201);
}, 'settings', 'write');
