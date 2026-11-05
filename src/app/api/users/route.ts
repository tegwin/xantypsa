import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  const tenantUsers = await prisma.tenantUser.findMany({
    where: { tenantId },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true, isActive: true, lastLogin: true, createdAt: true },
      },
      role: {
        select: { id: true, name: true, slug: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  const items = tenantUsers.map(tu => ({
    ...tu.user,
    role: tu.role,
    isOwner: tu.isOwner,
    joinedAt: tu.joinedAt,
  }));

  return jsonResponse({ items, total: items.length });
});

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name || !body.email || !body.password) {
    return errorResponse('Name, email, and password are required');
  }

  const tenantId = session.user.tenantId;

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (existing) {
    // User exists, just add to tenant
    const alreadyMember = await prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: existing.id } },
    });
    if (alreadyMember) return errorResponse('User is already a member of this tenant');

    let existingRoleId = body.roleId;
    if (!existingRoleId) {
      const fallbackRole = await prisma.role.findFirst({ where: { tenantId }, orderBy: { name: 'asc' } });
      if (!fallbackRole) return errorResponse('No roles exist. Create a role first.');
      existingRoleId = fallbackRole.id;
    }

    // Same rule on this path: the cost is of this membership, so somebody
    // joining a second tenant does not carry the first one's rate across.
    const existingCostRate =
      body.costRate === undefined || body.costRate === '' || body.costRate === null
        ? null
        : parseFloat(body.costRate);

    await prisma.tenantUser.create({
      data: {
        costRate: Number.isFinite(existingCostRate as number) ? existingCostRate : null,
        tenant: { connect: { id: tenantId } },
        user: { connect: { id: existing.id } },
        role: { connect: { id: existingRoleId } },
      },
    });
    return jsonResponse({ message: 'User added to tenant' }, 201);
  }

  // Create new user
  const passwordHash = await hash(body.password, 12);

  // Find role: use provided roleId, or fallback to first available role
  let roleId = body.roleId;
  if (!roleId) {
    const fallbackRole = await prisma.role.findFirst({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    if (!fallbackRole) return errorResponse('No roles exist. Create a role first in Settings → Roles.');
    roleId = fallbackRole.id;
  }

  // The cost rate belongs to the membership, not the person: the same engineer
  // can work for more than one MSP at a different cost to each. Sending it on
  // the user made every create fail with an unknown-argument error.
  const parsedCostRate =
    body.costRate === undefined || body.costRate === '' || body.costRate === null
      ? null
      : parseFloat(body.costRate);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
      phone: body.phone || null,
      tenants: {
        create: {
          costRate: Number.isFinite(parsedCostRate as number) ? parsedCostRate : null,
          tenant: { connect: { id: tenantId } },
          role: { connect: { id: roleId } },
        },
      },
    },
    select: { id: true, name: true, email: true },
  });

  return jsonResponse(user, 201);
}, 'settings', 'write');
