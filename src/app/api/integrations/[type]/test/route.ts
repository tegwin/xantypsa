import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { isPsaType, testPsaConnection } from '@/lib/integrations/psa';

/**
 * Ask the vendor something real.
 *
 * Takes the config from the request when one is sent, so the dialog can test
 * what is on screen before it is saved, and falls back to what is stored.
 */
export const POST = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/').filter(Boolean);
  const type = segments[segments.indexOf('integrations') + 1] || '';

  const body = await req.json().catch(() => ({}));

  let config: Record<string, string> = body.config || {};
  if (Object.keys(config).length === 0) {
    const saved = await prisma.integration.findFirst({
      where: { tenantId: session.user.tenantId, type },
    });
    if (!saved) return errorResponse('Nothing saved for this integration yet.', 404);
    config = (saved.config as Record<string, string>) || {};
  }

  if (!isPsaType(type)) {
    return errorResponse('There is no connection test for this integration yet.', 400);
  }

  const result = await testPsaConnection(type, config);
  return jsonResponse(result, result.ok ? 200 : 400);
}, 'settings', 'write');
