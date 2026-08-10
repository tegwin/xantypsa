import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType') || '';
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (entityType) where.entityType = entityType;

  const items = await prisma.customField.findMany({
    where,
    orderBy: { sortOrder: 'asc' },
  });

  return jsonResponse({ items });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.entityType || !body.name || !body.fieldKey || !body.fieldType) {
    return errorResponse('entityType, name, fieldKey, and fieldType are required');
  }

  const field = await prisma.customField.create({
    data: {
      tenantId: session.user.tenantId,
      entityType: body.entityType,
      name: body.name,
      fieldKey: body.fieldKey,
      fieldType: body.fieldType,
      options: body.options || [],
      required: body.required || false,
      sortOrder: body.sortOrder || 0,
    },
  });

  return jsonResponse(field, 201);
}, 'settings', 'write');
