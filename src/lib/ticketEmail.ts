import { prisma } from './prisma';
import { getSmtpConfig, getEmailTemplate, replaceTemplateVars, sendEmail, logEmail } from './email';

export async function sendTicketNotification(tenantId: string, ticketId: string, templateSlug: string) {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId },
      include: {
        company: { select: { name: true, email: true } },
        contact: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!ticket) return;

    const recipientEmail = ticket.contact?.email || ticket.company?.email;
    if (!recipientEmail) return;

    const config = await getSmtpConfig(tenantId);
    if (!config) return;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const template = await getEmailTemplate(tenantId, templateSlug);
    if (!template) return;

    const vars = {
      ticket_number: String(ticket.ticketNumber),
      ticket_title: ticket.title,
      customer_name: ticket.contact ? `${ticket.contact.firstName} ${ticket.contact.lastName}` : ticket.company?.name || 'Customer',
      company_name: tenant?.name || '',
      status: ticket.status,
      priority: ticket.priority,
      assigned_to: '',
    };

    const subject = replaceTemplateVars(template.subject, vars);
    const html = replaceTemplateVars(template.body, vars);

    await sendEmail(config, recipientEmail, subject, html);
    await logEmail(tenantId, null, recipientEmail, subject, 'sent');
  } catch (err) {
    console.error('sendTicketNotification error:', err);
  }
}

/**
 * Send one public ticket note to the customer as an email.
 *
 * Separate from sendTicketNotification because this carries the note body
 * itself rather than a status template, and because the caller needs to know
 * whether it actually went out. Returns a reason instead of throwing, so a
 * failed send never loses the note that was just saved.
 */
export async function sendPublicNoteEmail(
  tenantId: string,
  ticketId: string,
  noteContent: string,
  authorName: string,
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        company: { select: { name: true, email: true } },
        contact: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    if (!ticket) return { sent: false, reason: 'Ticket not found' };

    const recipientEmail = ticket.contact?.email || ticket.company?.email;
    if (!recipientEmail) {
      return { sent: false, reason: 'No contact or company email on this ticket' };
    }

    const config = await getSmtpConfig(tenantId);
    if (!config) return { sent: false, reason: 'Email is not configured' };

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const subject = `[#${ticket.ticketNumber}] ${ticket.title}`;

    // Plain, readable markup: the note is the message, nothing else.
    const escaped = noteContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const html = `
      <div style="font-family:system-ui,sans-serif;font-size:14px;color:#111">
        <p style="white-space:pre-wrap">${escaped}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0">
        <p style="color:#666;font-size:12px">
          ${authorName}${tenant?.name ? ` at ${tenant.name}` : ''}<br>
          Ticket #${ticket.ticketNumber}: ${ticket.title}
        </p>
      </div>`;

    await sendEmail(config, recipientEmail, subject, html);
    await logEmail(tenantId, null, recipientEmail, subject, 'sent');
    return { sent: true };
  } catch (err) {
    console.error('sendPublicNoteEmail error:', err);
    return { sent: false, reason: 'The email could not be sent' };
  }
}
