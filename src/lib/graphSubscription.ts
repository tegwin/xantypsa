// ============================================================
// Microsoft Graph mail subscriptions
// ============================================================
// Incoming email reaches VibePSA by webhook: Graph POSTs to
// /api/webhooks/microsoft-email the moment a message lands, and a ticket is
// raised from it. There is no polling.
//
// Graph subscriptions cannot be permanent — Microsoft caps mail subscriptions
// at 4230 minutes — so something has to renew them. That happens entirely on
// events, with no scheduled job:
//
//   * Graph posts a `reauthorizationRequired` lifecycle event as expiry nears,
//     and the webhook renews in response.
//   * Every ordinary notification also tops the expiry up, so a busy mailbox
//     sustains itself.
//   * If a subscription has already been reaped, renewal recreates it.

import crypto from 'crypto';
import { prisma } from './prisma';
import { getAccessToken, type MicrosoftConfig } from './emailProcessor';

/**
 * Graph caps mail subscriptions at 4230 minutes — just under three days.
 * Asking for more is rejected outright, so sit comfortably below it.
 */
export const MAX_SUBSCRIPTION_MINUTES = 4230;
const REQUEST_MINUTES = 4200;

/** Renew once less than this remains, so a missed run isn't fatal. */
export const RENEW_WHEN_UNDER_MINUTES = 1440; // 24 hours

export interface StoredSubscription {
  subscriptionId?: string;
  subscriptionExpiry?: string;
  /** Random secret echoed back by Graph, proving a notification is genuine. */
  subscriptionSecret?: string;
}

function expiryFromNow(minutes = REQUEST_MINUTES): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export function readSettings(tenant: { settings: unknown } | null): any {
  if (!tenant?.settings) return {};
  return typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings;
}

/** Persist subscription details back onto the tenant's Microsoft config. */
async function saveSubscription(
  tenantId: string,
  settings: any,
  msConfig: any,
  patch: StoredSubscription
) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: { ...settings, microsoft: { ...msConfig, ...patch } } },
  });
}

export function webhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!base || base.includes('localhost')) {
    throw new Error(
      'A public URL is required for Microsoft webhooks. Set NEXT_PUBLIC_APP_URL to ' +
        'your deployed domain — Graph cannot reach localhost.'
    );
  }
  return `${base.replace(/\/$/, '')}/api/webhooks/microsoft-email`;
}

/**
 * Create a subscription for a tenant's mailbox, replacing any existing one.
 */
export async function createSubscription(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const settings = readSettings(tenant);
  const msConfig = settings?.microsoft;

  if (!msConfig?.clientId || !msConfig?.clientSecret || !msConfig?.tenantId || !msConfig?.mailbox) {
    throw new Error('Microsoft 365 configuration incomplete. Fill in all fields first.');
  }

  const token = await getAccessToken(msConfig as MicrosoftConfig);

  // A random secret, not the tenant id. Graph echoes clientState back on every
  // notification, so it is the only thing proving a POST came from Microsoft
  // and not from anyone who guessed the webhook URL.
  const secret = crypto.randomBytes(32).toString('base64url');

  const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      changeType: 'created',
      notificationUrl: webhookUrl(),
      // Graph posts reauthorizationRequired / subscriptionRemoved here as
      // expiry approaches. This is what lets the webhook sustain itself
      // without a scheduled renewal job.
      lifecycleNotificationUrl: webhookUrl(),
      resource: `users/${msConfig.mailbox}/messages`,
      expirationDateTime: expiryFromNow(),
      clientState: secret,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Microsoft subscription failed: ${data.error?.message ?? JSON.stringify(data)}`);
  }

  await saveSubscription(tenantId, settings, msConfig, {
    subscriptionId: data.id,
    subscriptionExpiry: data.expirationDateTime,
    subscriptionSecret: secret,
  });

  return { subscriptionId: data.id as string, expiresAt: data.expirationDateTime as string };
}

/**
 * Push an existing subscription's expiry out. Falls back to creating a fresh
 * one if Graph has already forgotten it — the usual case after an outage.
 */
export async function renewSubscription(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const settings = readSettings(tenant);
  const msConfig = settings?.microsoft;

  if (!msConfig?.subscriptionId) {
    return { action: 'created' as const, ...(await createSubscription(tenantId)) };
  }

  const token = await getAccessToken(msConfig as MicrosoftConfig);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/subscriptions/${msConfig.subscriptionId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expirationDateTime: expiryFromNow() }),
    }
  );

  if (res.status === 404) {
    // Expired and reaped by Graph. Start again rather than give up.
    return { action: 'recreated' as const, ...(await createSubscription(tenantId)) };
  }

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Renewal failed: ${data.error?.message ?? JSON.stringify(data)}`);
  }

  await saveSubscription(tenantId, settings, msConfig, {
    subscriptionExpiry: data.expirationDateTime,
  });

  return {
    action: 'renewed' as const,
    subscriptionId: msConfig.subscriptionId as string,
    expiresAt: data.expirationDateTime as string,
  };
}

/** Minutes until the stored subscription lapses; negative once it has. */
export function minutesRemaining(expiry?: string): number | null {
  if (!expiry) return null;
  return Math.round((new Date(expiry).getTime() - Date.now()) / 60000);
}
