import nodemailer from 'nodemailer';
import { prisma } from './prisma';
import { decryptStoredSecret } from './crypto';

export interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  fromEmail: string;
  fromName: string;
}

export async function getSmtpConfig(tenantId: string): Promise<SmtpConfig | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant?.settings) return null;
  const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings;
  const smtp = (settings as any)?.smtp;
  if (!smtp?.host) return null;
  return {
    host: smtp.host,
    port: smtp.port || 587,
    username: smtp.username || '',
    // Stored encrypted; older tenants may still hold plaintext, which this
    // passes through unchanged.
    password: decryptStoredSecret(smtp.password),
    tls: smtp.tls !== false,
    fromEmail: smtp.fromEmail || tenant.email || 'noreply@example.com',
    fromName: smtp.fromName || tenant.name,
  };
}

export async function sendEmail(
  config: SmtpConfig,
  to: string,
  subject: string,
  html: string,
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
) {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.username, pass: config.password },
    tls: { rejectUnauthorized: false },
  });

  const result = await transport.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to,
    subject,
    html,
    attachments: attachments?.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType || 'application/pdf',
    })),
  });

  return result;
}

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  quote_send: {
    subject: 'Quote {quote_number} - {quote_title}',
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<p>Dear {customer_name},</p>
<p>Please find attached your quote <strong>{quote_number}</strong> for <strong>{quote_title}</strong>.</p>
<p>The total amount is <strong>{total}</strong> and this quote is valid until <strong>{expiry_date}</strong>.</p>
<p style="margin: 24px 0;"><a href="{quote_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Quote Online</a></p>
<p>{notes}</p>
<p>Best regards,<br><strong>{company_name}</strong><br>{company_email}</p>
</div>`,
  },
  quote_accepted: {
    subject: 'Quote {quote_number} - Accepted',
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<p>Dear {customer_name},</p>
<p>Thank you for accepting quote <strong>{quote_number}</strong> for <strong>{quote_title}</strong>.</p>
<p>We will be in touch shortly to proceed with the next steps.</p>
<p>Best regards,<br><strong>{company_name}</strong></p>
</div>`,
  },
  quote_reminder: {
    subject: 'Quote {quote_number} - Expiring Soon',
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<p>Dear {customer_name},</p>
<p>This is a friendly reminder that quote <strong>{quote_number}</strong> for <strong>{quote_title}</strong> will expire on <strong>{expiry_date}</strong>.</p>
<p style="margin: 24px 0;"><a href="{quote_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Quote</a></p>
<p>Best regards,<br><strong>{company_name}</strong></p>
</div>`,
  },
  quote_rejected: {
    subject: 'Quote {quote_number} - Feedback',
    body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<p>Dear {customer_name},</p>
<p>We noticed you declined quote <strong>{quote_number}</strong>. We would love to hear your feedback so we can improve our offerings.</p>
<p>Please don't hesitate to reach out if you'd like to discuss alternatives.</p>
<p>Best regards,<br><strong>{company_name}</strong></p>
</div>`,
  },
  ticket_created: {
    subject: 'Ticket #{ticket_number} - {ticket_title}',
    body: '<p>Dear {customer_name},</p><p>Your support ticket <strong>#{ticket_number}</strong> has been created.</p><p><strong>Title:</strong> {ticket_title}<br><strong>Priority:</strong> {priority}<br><strong>Status:</strong> {status}</p><p>We will review your request and get back to you shortly.</p><p>Best regards,<br>{company_name}</p>',
  },
  ticket_updated: {
    subject: 'Ticket #{ticket_number} - Updated',
    body: '<p>Dear {customer_name},</p><p>Your ticket <strong>#{ticket_number}</strong> ({ticket_title}) has been updated.</p><p><strong>Status:</strong> {status}</p><p>Best regards,<br>{company_name}</p>',
  },
  ticket_closed: {
    subject: 'Ticket #{ticket_number} - Resolved',
    body: '<p>Dear {customer_name},</p><p>Your ticket <strong>#{ticket_number}</strong> ({ticket_title}) has been resolved.</p><p>If you need further assistance, please don\'t hesitate to reach out.</p><p>Best regards,<br>{company_name}</p>',
  },
};

export async function getEmailTemplate(tenantId: string, slug: string) {
  const template = await prisma.emailTemplate.findFirst({
    where: { tenantId, slug },
  });
  if (template) return { subject: template.subject, body: template.body };
  return DEFAULT_TEMPLATES[slug] || null;
}

export function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}

export async function logEmail(
  tenantId: string,
  quoteId: string | null,
  recipient: string,
  subject: string,
  status: string,
  errorMessage?: string
) {
  await prisma.emailLog.create({
    data: { tenantId, quoteId, recipient, subject, status, errorMessage },
  });
}
