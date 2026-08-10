import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

// GET: Fetch all entity name overrides from tenant settings
export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });

  const settings = (tenant?.settings as any) || {};
  const entityNames = settings.entityNames || {};

  // Convert the stored map to an array of items
  const items = Object.entries(entityNames).map(([entityType, names]: [string, any]) => ({
    entityType,
    singular: names.singular,
    plural: names.plural,
  }));

  return jsonResponse({ items });
}, 'settings', 'read');

// PUT: Upsert an entity name override
export const PUT = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const { entityType, singular, plural } = body;

  if (!entityType || !singular || !plural) {
    return errorResponse('entityType, singular, and plural are required');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });

  const settings = (tenant?.settings as any) || {};
  const entityNames = settings.entityNames || {};

  // Update or remove the override
  if (singular && plural) {
    entityNames[entityType] = { singular, plural };
  }

  const updated = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      settings: {
        ...settings,
        entityNames,
      },
    },
  });

  return jsonResponse({ success: true, entityType, singular, plural });
}, 'settings', 'write');
