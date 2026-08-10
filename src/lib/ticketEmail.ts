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
