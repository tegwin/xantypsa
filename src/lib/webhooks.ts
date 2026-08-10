import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function dispatchWebhookEvent(
  tenantId: string,
  event: string,
  payload: object
) {
  try {
    // Fetch all active webhooks for this tenant
    const webhooks = await prisma.webhook.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    // Filter webhooks that subscribe to this event
    // events is stored as Json (array of strings)
    const matchingWebhooks = webhooks.filter((wh) => {
      const events = Array.isArray(wh.events) ? wh.events : [];
      return events.includes(event);
    });

    if (matchingWebhooks.length === 0) return;

    const body = JSON.stringify(payload);
    const timestamp = new Date().toISOString();

    await Promise.allSettled(
      matchingWebhooks.map(async (webhook) => {
        let statusCode = 0;
        let success = false;
        let responseBody = '';

        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Timestamp': timestamp,
          };

          if (webhook.secret) {
            const signature = crypto
              .createHmac('sha256', webhook.secret)
              .update(body)
              .digest('hex');
            headers['X-Webhook-Signature'] = signature;
          }

          // Merge custom headers from webhook config
          if (webhook.headers) {
            const customHeaders =
              typeof webhook.headers === 'string'
                ? JSON.parse(webhook.headers)
                : webhook.headers;
            if (typeof customHeaders === 'object' && customHeaders !== null) {
              Object.assign(headers, customHeaders);
            }
          }

          const res = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(10000),
          });

          statusCode = res.status;
          success = res.ok;
          responseBody = (await res.text()).slice(0, 500);
        } catch (err: any) {
          responseBody = (err.message || 'Unknown error').slice(0, 500);
        }

        await prisma.webhookLog.create({
          data: {
            webhook: { connect: { id: webhook.id } },
            tenant: { connect: { id: tenantId } },
            event,
            payload,
            statusCode,
            success,
            response: responseBody,
          },
        });
      })
    );
  } catch (err) {
    console.error('dispatchWebhookEvent error:', err);
  }
}
