import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

// GET service desk settings from tenant.settings JSON
export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as any) || {};
  return jsonResponse({
    billingMode: settings.serviceDeskBillingMode || 'anytime', // 'anytime' or 'on_close'
  });
}, 'settings', 'read');

// PATCH service desk settings
export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as any) || {};

  if (body.billingMode !== undefined) {
    settings.serviceDeskBillingMode = body.billingMode;
  }

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { settings },
  });

  return jsonResponse({ success: true, billingMode: settings.serviceDeskBillingMode });
}, 'settings', 'write');
