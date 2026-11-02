import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

const SCOPES = ['none', 'own', 'company'] as const;
const isScope = (v: any) => SCOPES.includes(v);

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const role = await prisma.portalRole.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!role) return errorResponse('Role not found', 404);

  const updated = await prisma.portalRole.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(isScope(body.ticketScope) && { ticketScope: body.ticketScope }),
      ...(isScope(body.quoteScope) && { quoteScope: body.quoteScope }),
      ...(isScope(body.projectScope) && { projectScope: body.projectScope }),
      ...(isScope(body.invoiceScope) && { invoiceScope: body.invoiceScope }),
      ...(isScope(body.reportScope) && { reportScope: body.reportScope }),
      ...(body.showBlocks !== undefined && { showBlocks: !!body.showBlocks }),
      ...(body.canCreateTickets !== undefined && { canCreateTickets: !!body.canCreateTickets }),
      ...(body.canReplyTickets !== undefined && { canReplyTickets: !!body.canReplyTickets }),
      ...(body.isDefault !== undefined && { isDefault: !!body.isDefault }),
      ...(body.isActive !== undefined && { isActive: !!body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: parseInt(body.sortOrder) || 0 }),
    },
  });

  if (updated.isDefault) {
    await prisma.portalRole.updateMany({
      where: { tenantId: session.user.tenantId, id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const role = await prisma.portalRole.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { _count: { select: { contacts: true } } },
  });
  if (!role) return errorResponse('Role not found', 404);

  // Deleting a role people are on would silently widen or narrow what they can
  // see, so it is deactivated instead.
  if (role._count.contacts > 0) {
    await prisma.portalRole.update({ where: { id }, data: { isActive: false } });
    return jsonResponse({
      deactivated: true,
      message: `${role._count.contacts} contact${role._count.contacts === 1 ? ' is' : 's are'} on this role, so it has been deactivated rather than deleted.`,
    });
  }

  await prisma.portalRole.delete({ where: { id } });
  return jsonResponse({ deleted: true });
}, 'settings', 'write');
