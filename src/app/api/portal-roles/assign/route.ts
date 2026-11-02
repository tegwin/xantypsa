import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

/**
 * Who is on a role, and putting people on it.
 *
 * Assigning in bulk matters because a role is useless until somebody has it,
 * and setting it one contact at a time does not scale past a handful.
 */
export const GET = withTenant(async (req: NextRequest, session: any) => {
  const roleId = req.nextUrl.searchParams.get('roleId');

  const contacts = await prisma.contact.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive: true,
      // Only people who can actually sign in: a role on somebody whose company
      // has no portal does nothing.
      company: { portalEnabled: true },
    },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      portalEnabled: true, portalRoleId: true,
      company: { select: { id: true, name: true } },
    },
    orderBy: [{ company: { name: 'asc' } }, { lastName: 'asc' }],
  });

  return jsonResponse({
    items: contacts,
    onThisRole: roleId ? contacts.filter((c) => c.portalRoleId === roleId).map((c) => c.id) : [],
  });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!Array.isArray(body.contactIds)) return errorResponse('contactIds is required');

  // null clears the role, putting those people back on the default.
  let roleId: string | null = null;
  if (body.roleId) {
    const role = await prisma.portalRole.findFirst({
      where: { id: body.roleId, tenantId: session.user.tenantId },
    });
    if (!role) return errorResponse('Role not found', 404);
    roleId = role.id;
  }

  const result = await prisma.contact.updateMany({
    // Scoped by tenant, so a contact id alone cannot reach another tenant.
    where: { id: { in: body.contactIds }, tenantId: session.user.tenantId },
    data: { portalRoleId: roleId },
  });

  return jsonResponse({ updated: result.count });
}, 'settings', 'write');
