import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';
import { readSettings, minutesRemaining } from '@/lib/graphSubscription';

/**
 * Health of the mail webhook, for Settings → Email Processing.
 *
 * Returns no secrets — the client secret and the clientState secret stay on the
 * server.
 */
export const GET = withTenant(async (_req: NextRequest, session: any) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  const ms = readSettings(tenant)?.microsoft;

  if (!ms?.clientId || !ms?.mailbox) {
    return jsonResponse({ connected: false, configured: false });
  }

  return jsonResponse({
    configured: true,
    connected: Boolean(ms.subscriptionId),
    mailbox: ms.mailbox,
    subscriptionId: ms.subscriptionId ?? null,
    expiresAt: ms.subscriptionExpiry ?? null,
    minutesRemaining: minutesRemaining(ms.subscriptionExpiry),
  });
}, 'settings', 'read');
