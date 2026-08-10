import { sendTicketNotification } from './ticketEmail';

export interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string; // Microsoft tenant ID
  mailbox: string; // email address to monitor
  accessToken?: string;
  refreshToken?: string;
}

export interface EmailProcessingResult {
  processed: number;
  ticketsCreated: number;
  notesAdded: number;
  errors: string[];
}

export async function getAccessToken(config: MicrosoftConfig): Promise<string> {
  // OAuth2 client credentials flow
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(tokenUrl, { method: 'POST', body: params });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

/**
 * Strip HTML tags from a string to get plain text.
 * Handles common HTML email patterns: <br>, <p>, block elements become newlines.
 */
function stripHtml(html: string): string {
  if (!html) return '';

  let text = html;
  // Replace <br> and <br/> with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // Replace closing block-level tags with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n');
  // Replace <li> with bullet points
  text = text.replace(/<li[^>]*>/gi, '- ');
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&apos;/gi, "'");
  // Collapse multiple blank lines into two
  text = text.replace(/\n{3,}/g, '\n\n');
  // Trim leading/trailing whitespace
  return text.trim();
}

/**
 * Try to extract a ticket number from an email subject.
 * Matches patterns like: #123, TKT-123, [Ticket #123], Ticket-123, Re: [TKT-456] etc.
 */
function extractTicketNumber(subject: string): number | null {
  if (!subject) return null;

  // Order matters: try most specific patterns first
  const patterns = [
    /\[Ticket\s*#?(\d+)\]/i,   // [Ticket #123] or [Ticket 123]
    /\bTKT-(\d+)\b/i,          // TKT-123
    /\bTicket-(\d+)\b/i,       // Ticket-123
    /\bTicket\s*#(\d+)\b/i,    // Ticket #123
    /#(\d+)\b/,                 // #123 (generic, last resort)
  ];

  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

export async function processIncomingEmails(appTenantId: string): Promise<EmailProcessingResult> {
  const result: EmailProcessingResult = {
    processed: 0,
    ticketsCreated: 0,
    notesAdded: 0,
    errors: [],
  };

  // Load config from tenant settings
  const { prisma } = await import('./prisma');
  const tenant = await prisma.tenant.findUnique({ where: { id: appTenantId } });
  if (!tenant?.settings) return result;

  const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings;
  const msConfig = (settings as any)?.microsoft;
  if (!msConfig?.clientId || !msConfig?.mailbox) return result;

  let token: string;
  try {
    token = await getAccessToken(msConfig);
  } catch (err: any) {
    result.errors.push(`Authentication failed: ${err.message}`);
    return result;
  }

  // Fetch unread messages
  let data: any;
  try {
    const url = `https://graph.microsoft.com/v1.0/users/${msConfig.mailbox}/messages?$filter=isRead eq false&$top=20&$orderby=receivedDateTime desc`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    data = await res.json();
  } catch (err: any) {
    result.errors.push(`Failed to fetch emails: ${err.message}`);
    return result;
  }

  if (!data.value?.length) return result;

  // Get owner user once for the entire batch
  const owner = await prisma.tenantUser.findFirst({ where: { tenantId: appTenantId, isOwner: true } });
  const ownerUserId = owner?.userId || '';

  for (const msg of data.value) {
    try {
      const senderEmail = msg.from?.emailAddress?.address;
      const senderName = msg.from?.emailAddress?.name || senderEmail || 'Unknown';
      const subject = msg.subject || '';

      // Get plain text content from the email body
      const rawBody = msg.body?.content || msg.bodyPreview || '';
      const bodyIsHtml = msg.body?.contentType === 'html';
      const plainTextBody = bodyIsHtml ? stripHtml(rawBody) : rawBody;

      // Check if this is a reply to existing ticket
      const ticketNumber = extractTicketNumber(subject);

      if (ticketNumber) {
        // Try to find the matching ticket
        const ticket = await prisma.ticket.findFirst({
          where: { tenantId: appTenantId, ticketNumber },
        });

        if (ticket) {
          // Add as note to existing ticket
          await prisma.ticketNote.create({
            data: {
              ticketId: ticket.id,
              userId: ownerUserId,
              content: `Email from ${senderName} (${senderEmail}):\n\n${plainTextBody}`,
              isInternal: false,
              isEmail: true,
            },
          });
          result.notesAdded++;
        } else {
          // Ticket number referenced but not found -- create a new ticket instead
          await createTicketFromEmail(prisma, appTenantId, ownerUserId, senderEmail, subject, plainTextBody, result);
        }
      } else {
        // No ticket reference -- create new ticket from email
        await createTicketFromEmail(prisma, appTenantId, ownerUserId, senderEmail, subject, plainTextBody, result);
      }

      // Mark email as read
      try {
        await fetch(`https://graph.microsoft.com/v1.0/users/${msConfig.mailbox}/messages/${msg.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        });
      } catch (markErr: any) {
        // Non-fatal: email was processed but couldn't be marked as read
        result.errors.push(`Could not mark email "${subject}" as read: ${markErr.message}`);
      }

      result.processed++;
    } catch (err: any) {
      const emailSubject = msg.subject || '(no subject)';
      result.errors.push(`Error processing email "${emailSubject}": ${err.message}`);
    }
  }

  return result;
}

/**
 * Create a new ticket from an incoming email.
 * Resolves contact by sender email (most recently active if duplicates exist),
 * assigns next ticket number, and sends auto-reply notification.
 */
async function createTicketFromEmail(
  prisma: any,
  tenantId: string,
  ownerUserId: string,
  senderEmail: string | undefined,
  subject: string,
  body: string,
  result: EmailProcessingResult,
) {
  // Find matching contact by sender email -- prefer most recently active
  let contact: any = null;
  if (senderEmail) {
    const contacts = await prisma.contact.findMany({
      where: { tenantId, email: senderEmail },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });
    contact = contacts[0] || null;
  }

  // Get next ticket number atomically
  const lastTicket = await prisma.ticket.findFirst({
    where: { tenantId },
    orderBy: { ticketNumber: 'desc' },
  });
  const nextNumber = (lastTicket?.ticketNumber || 0) + 1;

  const ticket = await prisma.ticket.create({
    data: {
      tenantId,
      ticketNumber: nextNumber,
      title: subject || 'Email inquiry',
      description: body,
      status: 'new',
      priority: 'medium',
      type: 'incident',
      source: 'email',
      companyId: contact?.companyId || null,
      contactId: contact?.id || null,
      createdById: ownerUserId,
    },
  });

  result.ticketsCreated++;

  // Send auto-reply using ticket_created template (fire-and-forget, don't block processing)
  try {
    await sendTicketNotification(tenantId, ticket.id, 'ticket_created');
  } catch (notifyErr: any) {
    result.errors.push(`Ticket #${nextNumber} created but auto-reply failed: ${notifyErr.message}`);
  }
}
