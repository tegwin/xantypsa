import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';
import { refFormatFromSettings, DEFAULT_PREFIXES, type RefEntity } from '@/lib/references';

/**
 * How every reference in the system reads: one prefix per record type, one
 * separator, one padding. Changing these changes how records display; it never
 * renumbers anything.
 */
export const GET = withTenant(async (_req: NextRequest, session: any) => {
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as any) || {};
  const highest = await prisma.ticket.findFirst({
    where: { tenantId: session.user.tenantId },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });
  return jsonResponse({
    ...refFormatFromSettings(settings),
    ticketStartNumber: settings.ticketStartNumber ?? null,
    highestTicketNumber: highest?.ticketNumber ?? 0,
  });
}, 'settings', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as any) || {};

  if (body.prefixes && typeof body.prefixes === 'object') {
    settings.referencePrefixes = settings.referencePrefixes || {};
    for (const key of Object.keys(DEFAULT_PREFIXES) as RefEntity[]) {
      if (body.prefixes[key] === undefined) continue;
      // Uppercase, letters and digits only, so a reference is always quotable.
      settings.referencePrefixes[key] = String(body.prefixes[key])
        .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    }
  }
  if (body.padding !== undefined) {
    settings.referencePadding = Math.max(0, Math.min(12, parseInt(body.padding) || 0));
  }
  if (body.separator !== undefined) {
    settings.referenceSeparator = String(body.separator).slice(0, 2);
  }
  if (body.ticketStartNumber !== undefined) {
    const n = parseInt(body.ticketStartNumber);
    settings.ticketStartNumber = Number.isFinite(n) && n > 0 ? n : null;
  }

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { settings },
  });

  return jsonResponse({
    ...refFormatFromSettings(settings),
    ticketStartNumber: settings.ticketStartNumber ?? null,
  });
}, 'settings', 'write');
