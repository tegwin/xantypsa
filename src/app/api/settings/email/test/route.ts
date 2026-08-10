import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getSmtpConfig, sendEmail } from '@/lib/email';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const config = await getSmtpConfig(session.user.tenantId);
  if (!config) return errorResponse('SMTP not configured', 400);

  const to = body.to || session.user.email;
  try {
    await sendEmail(config, to, 'Test Email - SMTP Configuration', '<h2>SMTP Configuration Test</h2><p>This is a test email to verify your SMTP settings are working correctly.</p><p>If you received this email, your configuration is correct.</p>');
    return jsonResponse({ success: true, message: `Test email sent to ${to}` });
  } catch (err: any) {
    return errorResponse(`Failed to send: ${err.message}`, 500);
  }
}, 'settings', 'write');
