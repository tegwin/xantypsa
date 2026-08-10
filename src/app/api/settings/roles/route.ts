import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req, session) => {
  const roles = await prisma.role.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true } } },
  });
  return jsonResponse({ items: roles });
}, 'settings', 'read');

export const POST = withTenant(async (req, session) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Role name required');
  const slug = body.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const role = await prisma.role.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      slug,
      description: body.description || null,
      permissions: body.permissions || [],
    },
  });
  return jsonResponse(role, 201);
}, 'settings', 'write');
