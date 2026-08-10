import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { createSubscription } from '@/lib/graphSubscription';

/**
 * Connect the mailbox: create the Graph subscription that pushes new mail to
 * /api/webhooks/microsoft-email. Called once from Settings → Email; the daily
 * cron keeps it alive from then on.
 */
export const POST = withTenant(async (_req: NextRequest, session: any) => {
  try {
    const { subscriptionId, expiresAt } = await createSubscription(session.user.tenantId);
    return jsonResponse({
      success: true,
      subscriptionId,
      expiresAt,
      message:
        'Mailbox connected. Incoming email now creates tickets automatically, and the ' +
        'subscription renews itself daily.',
    });
  } catch (err: any) {
    return errorResponse(err.message, 400);
  }
}, 'settings', 'write');
