import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';
import { REQUIRED_FIELDS, crmRequiredFromSettings } from '@/lib/crmRequired';

export const GET = withTenant(async (_req: NextRequest, session: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });
  return jsonResponse({ required: crmRequiredFromSettings(tenant?.settings) });
}, 'settings', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as any) || {};
  settings.crmRequired = settings.crmRequired || {};

  for (const f of REQUIRED_FIELDS) {
    if (body.required?.[f] !== undefined) settings.crmRequired[f] = !!body.required[f];
  }

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { settings },
  });

  return jsonResponse({ required: crmRequiredFromSettings(settings) });
}, 'settings', 'write');
