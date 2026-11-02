import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { isPsaType, fetchPsaRecords, missingFields } from '@/lib/integrations/psa';

const ENTITIES = ['companies', 'contacts', 'tickets'] as const;
type Entity = typeof ENTITIES[number];

/**
 * Read companies, contacts or tickets out of the PSA.
 *
 * Read-only: it shows what is there so you can decide what to bring across.
 */
export const GET = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/').filter(Boolean);
  const type = segments[segments.indexOf('integrations') + 1] || '';
  const entity = (req.nextUrl.searchParams.get('entity') || 'companies') as Entity;

  if (!isPsaType(type)) return errorResponse('Not a PSA integration.', 400);
  if (!ENTITIES.includes(entity)) {
    return errorResponse(`entity must be one of ${ENTITIES.join(', ')}.`);
  }

  const saved = await prisma.integration.findFirst({
    where: { tenantId: session.user.tenantId, type, isActive: true },
  });
  if (!saved) return errorResponse(`Configure ${type} first.`, 404);

  const config = (saved.config as Record<string, string>) || {};
  const missing = missingFields(type, config);
  if (missing.length > 0) return errorResponse(`Fill these in first: ${missing.join(', ')}.`);

  try {
    const items = await fetchPsaRecords(type, config, entity, 200);
    return jsonResponse({ entity, items, count: items.length });
  } catch (err: any) {
    return errorResponse(err.message || 'Could not read from the PSA.', 502);
  }
}, 'settings', 'read');
