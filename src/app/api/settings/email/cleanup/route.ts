import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';
import { cleanupOptionsFrom } from '@/lib/emailCleanup';

/** How much of an incoming email is kept on the ticket. */
export const GET = withTenant(async (_req: NextRequest, session: any) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  const settings =
    typeof tenant?.settings === 'string' ? JSON.parse(tenant.settings) : (tenant?.settings || {});
  return jsonResponse(cleanupOptionsFrom(settings));
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  const settings =
    typeof tenant?.settings === 'string' ? JSON.parse(tenant.settings) : (tenant?.settings || {});

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      settings: {
        ...(settings as any),
        emailCleanup: {
          stripSignature: body.stripSignature !== false,
          stripQuotedHistory: body.stripQuotedHistory !== false,
        },
      },
    },
  });

  return jsonResponse({ success: true });
}, 'settings', 'write');
