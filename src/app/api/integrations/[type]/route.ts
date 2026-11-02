import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { isPsaType, missingFields } from '@/lib/integrations/psa';

// GET /api/integrations/[type] - Get integration config
export const GET = withTenant(async (req: NextRequest, session: any) => {
  const url = new URL(req.url);
  const type = url.pathname.split('/').filter(Boolean).pop() || '';

  const integration = await prisma.integration.findFirst({
    where: { tenantId: session.user.tenantId, type },
  });

  if (!integration) {
    return jsonResponse(null);
  }

  return jsonResponse(integration);
}, 'settings', 'read');

// POST /api/integrations/[type] - Save/update integration config
export const POST = withTenant(async (req: NextRequest, session: any) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const type = segments[segments.length - 1] || '';
  const body = await req.json();

  // An integration saved with no credentials used to look connected, which is
  // worse than not having it: the card says it works and nothing does.
  if (isPsaType(type)) {
    const config = { ...(body.config || {}) };
    const missing = missingFields(type, config);
    if (missing.length > 0) {
      return errorResponse(`Fill these in first: ${missing.join(', ')}.`);
    }
  }

  const existing = await prisma.integration.findFirst({
    where: { tenantId: session.user.tenantId, type },
  });

  let integration;
  if (existing) {
    integration = await prisma.integration.update({
      where: { id: existing.id },
      data: {
        name: body.name || existing.name,
        config: body.config || existing.config,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
      },
    });
  } else {
    integration = await prisma.integration.create({
      data: {
        tenantId: session.user.tenantId,
        type,
        name: body.name || type,
        config: body.config || {},
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });
  }

  return jsonResponse(integration);
}, 'settings', 'write');
