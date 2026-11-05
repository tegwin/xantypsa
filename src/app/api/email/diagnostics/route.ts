import { NextRequest } from 'next/server';
import { withTenant, jsonResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { webhookUrl } from '@/lib/graphSubscription';

/**
 * Say exactly where inbound email is breaking.
 *
 * Every failure inside the webhook handler is a `continue`, which is right for
 * a notification but useless for an administrator staring at an empty ticket
 * list. This asks Microsoft the same questions by hand and reports each answer,
 * so "nothing is arriving" becomes a named cause.
 *
 * Read-only: it creates nothing and changes nothing.
 */
export const GET = withTenant(async (_req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const settings =
    typeof tenant?.settings === 'string' ? JSON.parse(tenant.settings) : (tenant?.settings as any);
  const ms = settings?.microsoft;

  if (!ms?.clientId || !ms?.clientSecret || !ms?.tenantId || !ms?.mailbox) {
    checks.push({ name: 'Configuration', ok: false, detail: 'Microsoft 365 details are incomplete.' });
    return jsonResponse({ mailbox: ms?.mailbox ?? null, checks });
  }
  checks.push({ name: 'Configuration', ok: true, detail: `Mailbox ${ms.mailbox}` });

  // --- token -------------------------------------------------------
  let token = '';
  try {
    const res = await fetch(`https://login.microsoftonline.com/${ms.tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ms.clientId,
        client_secret: ms.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    });
    const data = await res.json();
    token = data.access_token || '';
    checks.push({
      name: 'Sign in to Microsoft',
      ok: !!token,
      detail: token ? 'Credentials accepted.' : data.error_description || 'No token returned.',
    });
  } catch (err: any) {
    checks.push({ name: 'Sign in to Microsoft', ok: false, detail: err.message });
  }
  if (!token) return jsonResponse({ mailbox: ms.mailbox, checks });

  const auth = { Authorization: `Bearer ${token}` };

  // --- can we read the mailbox? ------------------------------------
  // This is the usual culprit: a mailbox that does not exist, or Mail.Read
  // granted but never admin-consented.
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(ms.mailbox)}/messages?$top=3&$select=subject,receivedDateTime,isRead`,
      { headers: auth }
    );
    const data = await res.json();
    if (!res.ok) {
      checks.push({
        name: 'Read the mailbox',
        ok: false,
        detail: `${data.error?.code ?? res.status}: ${data.error?.message ?? 'Unknown error'}`,
      });
    } else {
      const n = data.value?.length ?? 0;
      checks.push({
        name: 'Read the mailbox',
        ok: true,
        detail: n
          ? `Newest message: "${data.value[0].subject || '(no subject)'}" at ${data.value[0].receivedDateTime}`
          : 'The mailbox is readable but empty.',
      });
    }
  } catch (err: any) {
    checks.push({ name: 'Read the mailbox', ok: false, detail: err.message });
  }

  // --- does Microsoft still hold the subscription? ------------------
  if (!ms.subscriptionId) {
    checks.push({ name: 'Subscription', ok: false, detail: 'None recorded. Press Reconnect.' });
  } else {
    try {
      const res = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${ms.subscriptionId}`, {
        headers: auth,
      });
      const data = await res.json();
      if (!res.ok) {
        checks.push({
          name: 'Subscription',
          ok: false,
          detail: `Microsoft no longer has it (${data.error?.code ?? res.status}). Press Reconnect.`,
        });
      } else {
        // A notificationUrl pointing somewhere else is why notifications go
        // missing after the app URL changes.
        const expected = webhookUrl();
        const matches = data.notificationUrl === expected;
        checks.push({
          name: 'Subscription',
          ok: matches,
          detail: matches
            ? `Live until ${data.expirationDateTime}, notifying ${data.notificationUrl}`
            : `Microsoft is notifying ${data.notificationUrl}, but this app is at ${expected}. Press Reconnect.`,
        });
      }
    } catch (err: any) {
      checks.push({ name: 'Subscription', ok: false, detail: err.message });
    }
  }

  // --- can the app send? -------------------------------------------
  // Mail.Send is separate from Mail.Read, and a tenant can easily have one
  // without the other.
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(ms.mailbox)}/mailFolders/sentitems?$select=displayName`,
      { headers: auth }
    );
    checks.push({
      name: 'Mailbox reachable for sending',
      ok: res.ok,
      detail: res.ok
        ? 'Sent Items is readable, so the mailbox resolves. Use Send test email to prove Mail.Send.'
        : `Could not read Sent Items (${res.status}).`,
    });
  } catch (err: any) {
    checks.push({ name: 'Mailbox reachable for sending', ok: false, detail: err.message });
  }

  return jsonResponse({ mailbox: ms.mailbox, webhookUrl: webhookUrl(), checks });
}, 'settings', 'read');
