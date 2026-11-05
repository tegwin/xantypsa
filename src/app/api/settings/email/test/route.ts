import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { deliverEmail } from '@/lib/email';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const to = body.to || session.user.email;
  try {
    const result = await deliverEmail(
      session.user.tenantId,
      to,
      'Test email from Xanty PSA',
      '<h2>Outbound email works</h2><p>This test was sent by Xanty PSA. If it reached you, sending is configured correctly.</p>',
    );
    if (!result.sent) return errorResponse(result.reason, 400);
    // Say which route carried it, so a tenant can see whether Graph or the
    // SMTP fallback is actually doing the work.
    return jsonResponse({
      success: true,
      message: `Test email sent to ${to} via ${result.via === 'graph' ? 'Microsoft 365' : 'SMTP'}`,
    });
  } catch (err: any) {
    return errorResponse(`Failed to send: ${err.message}`, 500);
  }
}, 'settings', 'write');
