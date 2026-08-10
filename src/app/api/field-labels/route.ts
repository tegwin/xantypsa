import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType') || '';
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (entityType) where.entityType = entityType;

  const items = await prisma.fieldLabel.findMany({
    where,
    orderBy: { entityType: 'asc' },
  });

  return jsonResponse({ items });
}, 'settings', 'read');

export const PUT = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.entityType || !body.fieldName || !body.label) {
    return errorResponse('entityType, fieldName, and label are required');
  }

  const tenantId = session.user.tenantId;

  const label = await prisma.fieldLabel.upsert({
    where: {
      tenantId_entityType_fieldName: {
        tenantId,
        entityType: body.entityType,
        fieldName: body.fieldName,
      },
    },
    update: {
      label: body.label,
    },
    create: {
      tenantId,
      entityType: body.entityType,
      fieldName: body.fieldName,
      label: body.label,
    },
  });

  return jsonResponse(label);
}, 'settings', 'write');
