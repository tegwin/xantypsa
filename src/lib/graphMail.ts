// ============================================================
// Sending through Microsoft Graph
// ============================================================
// The same app registration that receives mail also sends it, so one set of
// credentials covers both directions and there is no SMTP password to store.
// SMTP stays as the fallback for tenants that have no Microsoft app, or whose
// app has not been granted Mail.Send.

import { prisma } from './prisma';

export interface GraphSender {
  mailbox: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;
}

/** Read a tenant's Microsoft app, or null when it cannot send. */
export async function getGraphSender(tenantId: string): Promise<GraphSender | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.settings) return null;

  const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings;
  const ms = (settings as any)?.microsoft;
  if (!ms?.clientId || !ms?.clientSecret || !ms?.tenantId || !ms?.mailbox) return null;

  return {
    mailbox: ms.mailbox,
    clientId: ms.clientId,
    clientSecret: ms.clientSecret,
    tenantId: ms.tenantId,
  };
}

/**
 * A token of its own rather than one borrowed from emailProcessor: importing
 * that module here would close a cycle through ticketEmail and back into
 * lib/email.
 */
async function getToken(sender: GraphSender): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${sender.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: sender.clientId,
        client_secret: sender.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description || 'Microsoft would not issue a token');
  }
  return data.access_token;
}

/**
 * Send one message as the monitored mailbox.
 *
 * Throws on any failure so the caller can fall back to SMTP; a silent return
 * would make a missing Mail.Send permission look like a delivered email.
 */
export async function sendViaGraph(
  sender: GraphSender,
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
) {
  const token = await getToken(sender);

  const message: any = {
    subject,
    body: { contentType: 'HTML', content: html },
    toRecipients: [{ emailAddress: { address: to } }],
  };

  if (attachments?.length) {
    message.attachments = attachments.map((a) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.filename,
      contentType: a.contentType || 'application/pdf',
      contentBytes: a.content.toString('base64'),
    }));
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender.mailbox)}/sendMail`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // Keep a copy in Sent Items, so the mailbox owner sees what the system
      // said to their customer.
      body: JSON.stringify({ message, saveToSentItems: true }),
    }
  );

  if (res.status === 202) return { messageId: 'graph', accepted: [to], rejected: [] } as any;

  const body = await res.text();
  throw new Error(`Graph sendMail failed (${res.status}): ${body.slice(0, 300)}`);
}
