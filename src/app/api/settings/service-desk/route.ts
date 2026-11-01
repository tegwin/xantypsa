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
    // Timer defaults to running whenever a ticket is open. Each option below
    // narrows when it runs; with both off it never pauses itself.
    timerEnabled: settings.serviceDeskTimerEnabled ?? true,
    timerOnlyOnTimeEntry: settings.serviceDeskTimerOnlyOnTimeEntry ?? false,
    timerOnlyOnPublicNotes: settings.serviceDeskTimerOnlyOnPublicNotes ?? false,
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
  if (body.timerEnabled !== undefined) {
    settings.serviceDeskTimerEnabled = !!body.timerEnabled;
  }
  if (body.timerOnlyOnTimeEntry !== undefined) {
    settings.serviceDeskTimerOnlyOnTimeEntry = !!body.timerOnlyOnTimeEntry;
  }
  if (body.timerOnlyOnPublicNotes !== undefined) {
    settings.serviceDeskTimerOnlyOnPublicNotes = !!body.timerOnlyOnPublicNotes;
  }

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { settings },
  });

  return jsonResponse({
    success: true,
    billingMode: settings.serviceDeskBillingMode,
    timerEnabled: settings.serviceDeskTimerEnabled ?? true,
    timerOnlyOnTimeEntry: settings.serviceDeskTimerOnlyOnTimeEntry ?? false,
    timerOnlyOnPublicNotes: settings.serviceDeskTimerOnlyOnPublicNotes ?? false,
  });
}, 'settings', 'write');
