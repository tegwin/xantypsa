import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { routeIncomingEmail } from '@/lib/emailRouting';
import { renewSubscription, minutesRemaining, RENEW_WHEN_UNDER_MINUTES } from '@/lib/graphSubscription';

/**
 * Keep the subscription alive without a scheduled job.
 *
 * Graph mail subscriptions cannot be permanent - 4230 minutes is Microsoft's
 * hard ceiling - so something must renew them. Rather than a timer, this runs
 * off the events Graph already sends us: every notification is a chance to top
 * the expiry back up, and Graph additionally sends an explicit
 * `reauthorizationRequired` lifecycle event when one is close to lapsing.
 */
async function renewIfExpiringSoon(tenantId: string, expiry?: string) {
  const remaining = minutesRemaining(expiry);
  if (remaining !== null && remaining > RENEW_WHEN_UNDER_MINUTES) return;
  try {
    await renewSubscription(tenantId);
  } catch (err: any) {
    // Never fail the notification because renewal failed - the email still
    // needs to become a ticket.
    console.error('[ms-email] renewal failed:', err.message);
  }
}

/** Constant-time compare, so a wrong secret cannot be found by timing. */
function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/**
 * Find the tenant that owns a subscription id.
 *
 * Subscription ids live inside the tenant settings JSON, so this filters in
 * Postgres on the JSON path rather than reading every tenant into memory.
 */
async function findTenantBySubscription(subscriptionId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; settings: any }>>`
    SELECT id, settings FROM tenants
    WHERE settings -> 'microsoft' ->> 'subscriptionId' = ${subscriptionId}
    LIMIT 1
  `;
  if (rows[0]) return rows[0];

  // Older rows can hold settings as a JSON *string* rather than an object, and
  // the path query above cannot see inside those. Fall back to a scan - tenant
  // counts are small, and missing a notification loses an email.
  const all = await prisma.tenant.findMany({ select: { id: true, settings: true } });
  return (
    all.find((t) => {
      const s = typeof t.settings === 'string' ? JSON.parse(t.settings) : t.settings;
      return (s as any)?.microsoft?.subscriptionId === subscriptionId;
    }) ?? null
  );
}

/**
 * The resource is interpolated into a Graph URL, so constrain what it can
 * address: a single message under a user, nothing else.
 *
 * Deliberately shape-only. Graph reports the mailbox as an object GUID rather
 * than the address subscribed with, so comparing it to the configured mailbox
 * would reject every genuine notification. Authenticity is established by
 * clientState; this stops the path being pointed at another Graph endpoint.
 */
function isMessageResource(resource: unknown): resource is string {
  if (typeof resource !== 'string') return false;
  if (resource.includes('..') || resource.includes('://')) return false;
  return /^\/?users\/[^/]+\/messages(\/|\()[^/]+\)?$/i.test(resource);
}

// Microsoft Graph sends a validation request first (GET with validationToken)
// Then sends POST notifications when emails arrive

export async function POST(req: NextRequest) {
  // Handle Microsoft Graph subscription validation
  const validationToken = new URL(req.url).searchParams.get('validationToken');
  if (validationToken) {
    // Microsoft sends this to validate the webhook endpoint
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  try {
    const body = await req.json();
    const notifications = body.value || [];

    for (const notification of notifications) {
      // Each notification carries: subscriptionId, resource, changeType, clientState
      const { resource, changeType, clientState, subscriptionId, lifecycleEvent } = notification;

      if (!clientState || !subscriptionId) continue;

      // ---- Lifecycle events -------------------------------------------
      // Graph sends these instead of a resource change when a subscription
      // needs attention. `reauthorizationRequired` arrives before expiry and is
      // what keeps the webhook alive with no scheduled job. `subscriptionRemoved`
      // means it is already gone and must be rebuilt.
      if (lifecycleEvent) {
        const t = await findTenantBySubscription(subscriptionId);
        if (!t) continue;
        const s = typeof t.settings === 'string' ? JSON.parse(t.settings) : t.settings;
        if (!safeEqual(clientState, (s as any)?.microsoft?.subscriptionSecret ?? '')) continue;

        if (lifecycleEvent === 'reauthorizationRequired' || lifecycleEvent === 'subscriptionRemoved') {
          try {
            await renewSubscription(t.id);
          } catch (err: any) {
            console.error(`[ms-email] ${lifecycleEvent} recovery failed:`, err.message);
          }
        }
        continue;
      }

      if (changeType !== 'created') continue; // Only process new emails

      // This endpoint is public - Graph cannot authenticate to it. The only
      // proof a notification is genuine is clientState, the random secret we
      // handed Microsoft when subscribing. Look the tenant up *by
      // subscriptionId*, then verify the secret; never trust an id supplied in
      // the request body to say which tenant this is.
      const tenant = await findTenantBySubscription(subscriptionId);
      if (!tenant) continue;

      const settings =
        typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings;
      const msConfig = (settings as any)?.microsoft;
      if (!msConfig?.clientId || !msConfig?.subscriptionSecret) continue;

      if (!safeEqual(clientState, msConfig.subscriptionSecret)) {
        console.warn('[ms-email] rejected notification with bad clientState');
        continue;
      }

      // The resource is interpolated into a Graph URL below, so pin it to this
      // tenant's own mailbox rather than fetching whatever path was sent.
      if (!isMessageResource(resource)) {
        console.warn('[ms-email] rejected notification for unexpected resource');
        continue;
      }

      const tenantId = tenant.id;

      // Every genuine notification is a chance to push the expiry out, so an
      // active mailbox never lets its subscription lapse.
      await renewIfExpiringSoon(tenantId, msConfig.subscriptionExpiry);

      // Get access token
      const tokenUrl = `https://login.microsoftonline.com/${msConfig.tenantId}/oauth2/v2.0/token`;
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: msConfig.clientId,
          client_secret: msConfig.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) continue;

      // Fetch the actual email message
      const msgUrl = `https://graph.microsoft.com/v1.0/${resource}`;
      const msgRes = await fetch(msgUrl, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const msg = await msgRes.json();

      if (!msg.id) continue;

      // Check if email is already processed (by message ID in customData)
      const existingNote = await prisma.ticketNote.findFirst({
        where: { content: { contains: msg.id } },
      });
      if (existingNote) continue;

      // Extract ticket number from subject
      const ticketMatch = msg.subject?.match(/(?:\[Ticket\s*#?|TKT-|Ticket-|Ticket\s*#|#)(\d+)/i);

      const senderEmail = msg.from?.emailAddress?.address;
      // Known contact → their company; else the sender's domain → that client;
      // else the catch-all, so nothing is ever dropped.
      const route = await routeIncomingEmail(tenantId, senderEmail);

      // Strip HTML from body
      const bodyContent = (msg.body?.content || msg.bodyPreview || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      if (ticketMatch) {
        // Add note to existing ticket
        const ticketNumber = parseInt(ticketMatch[1]);
        const ticket = await prisma.ticket.findFirst({ where: { tenantId, ticketNumber } });
        if (ticket) {
          const owner = await prisma.tenantUser.findFirst({ where: { tenantId, isOwner: true } });
          await prisma.ticketNote.create({
            data: {
              ticketId: ticket.id,
              userId: owner?.userId || '',
              content: `Email from ${senderEmail}:\n\n${bodyContent}\n\n[Email ID: ${msg.id}]`,
              isInternal: false,
              isEmail: true,
            },
          });
        }
      } else {
        // Create new ticket
        const lastTicket = await prisma.ticket.findFirst({
          where: { tenantId },
          orderBy: { ticketNumber: 'desc' },
        });
        const nextNumber = (lastTicket?.ticketNumber || 0) + 1;
        const owner = await prisma.tenantUser.findFirst({ where: { tenantId, isOwner: true } });

        await prisma.ticket.create({
          data: {
            tenantId,
            ticketNumber: nextNumber,
            title: msg.subject || 'Email inquiry',
            description: `${bodyContent}\n\n---\nFrom: ${senderEmail}\n[Email ID: ${msg.id}]`,
            status: 'new',
            priority: 'medium',
            type: 'incident',
            source: 'email',
            companyId: route.companyId,
            contactId: route.contactId,
            createdById: owner?.userId || '',
          },
        });

        // Send auto-reply
        try {
          const { sendTicketNotification } = await import('@/lib/ticketEmail');
          const newTicket = await prisma.ticket.findFirst({
            where: { tenantId, ticketNumber: nextNumber },
          });
          if (newTicket) {
            sendTicketNotification(tenantId, newTicket.id, 'ticket_created');
          }
        } catch {}
      }

      // Mark email as read
      try {
        await fetch(`https://graph.microsoft.com/v1.0/${resource}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isRead: true }),
        });
      } catch {}
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Microsoft email webhook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Handle GET for subscription validation
export async function GET(req: NextRequest) {
  const validationToken = new URL(req.url).searchParams.get('validationToken');
  if (validationToken) {
    return new Response(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return NextResponse.json({ status: 'Microsoft Email Webhook endpoint active' });
}
