import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('webhooks') + 1];

  const webhook = await prisma.webhook.findFirst({
    where: { id, tenantId },
  });

  if (!webhook) {
    return errorResponse('Webhook not found', 404);
  }

  const testPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test webhook delivery.' },
  };

  const body = JSON.stringify(testPayload);
  const timestamp = new Date().toISOString();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': 'webhook.test',
    'X-Webhook-Timestamp': timestamp,
  };

  if (webhook.secret) {
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(body)
      .digest('hex');
    headers['X-Webhook-Signature'] = signature;
  }

  if (webhook.headers) {
    const customHeaders =
      typeof webhook.headers === 'string'
        ? JSON.parse(webhook.headers)
        : webhook.headers;
    Object.assign(headers, customHeaders);
  }

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = (await res.text()).slice(0, 500);

    await prisma.webhookLog.create({
      data: {
        webhook: { connect: { id: webhook.id } },
        tenant: { connect: { id: tenantId } },
        event: 'webhook.test',
        payload: testPayload,
        statusCode: res.status,
        success: res.ok,
        response: responseBody,
      },
    });

    return jsonResponse({
      success: res.ok,
      statusCode: res.status,
      response: responseBody,
    });
  } catch (err: any) {
    const errorMessage = (err.message || 'Unknown error').slice(0, 500);

    await prisma.webhookLog.create({
      data: {
        webhook: { connect: { id: webhook.id } },
        tenant: { connect: { id: tenantId } },
        event: 'webhook.test',
        payload: testPayload,
        statusCode: 0,
        success: false,
        response: errorMessage,
      },
    });

    return jsonResponse({
      success: false,
      statusCode: null,
      response: errorMessage,
    });
  }
});
