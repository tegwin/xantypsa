import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

const DEFAULT_TEMPLATES = [
  { slug: 'quote_send', name: 'Quote Sent', subject: 'Quote {quote_number} - {quote_title}', body: '<p>Dear {customer_name},</p><p>Please find attached your quote <strong>{quote_number}</strong> for <strong>{quote_title}</strong>.</p><p>Total: <strong>{total}</strong> | Valid until: <strong>{expiry_date}</strong></p><p><a href="{quote_link}">View Quote Online</a></p><p>Best regards,<br>{company_name}</p>' },
  { slug: 'quote_accepted', name: 'Quote Accepted', subject: 'Quote {quote_number} - Accepted', body: '<p>Dear {customer_name},</p><p>Thank you for accepting quote {quote_number}. We will be in touch shortly.</p><p>Best regards,<br>{company_name}</p>' },
  { slug: 'quote_reminder', name: 'Quote Reminder', subject: 'Quote {quote_number} - Expiring Soon', body: '<p>Dear {customer_name},</p><p>Your quote {quote_number} will expire on {expiry_date}.</p><p><a href="{quote_link}">View Quote</a></p><p>Best regards,<br>{company_name}</p>' },
  { slug: 'quote_rejected', name: 'Quote Rejected', subject: 'Quote {quote_number} - Feedback', body: '<p>Dear {customer_name},</p><p>We noticed you declined quote {quote_number}. We would love to hear your feedback.</p><p>Best regards,<br>{company_name}</p>' },
  { slug: 'ticket_created', name: 'Ticket Created', subject: 'Ticket #{ticket_number} - {ticket_title}', body: '<p>Dear {customer_name},</p><p>Your support ticket <strong>#{ticket_number}</strong> has been created.</p><p><strong>Title:</strong> {ticket_title}<br><strong>Priority:</strong> {priority}<br><strong>Status:</strong> {status}</p><p>We will review your request and get back to you shortly.</p><p>Best regards,<br>{company_name}</p>' },
  { slug: 'ticket_updated', name: 'Ticket Updated', subject: 'Ticket #{ticket_number} - Updated', body: '<p>Dear {customer_name},</p><p>Your ticket <strong>#{ticket_number}</strong> ({ticket_title}) has been updated.</p><p><strong>Status:</strong> {status}</p><p>Best regards,<br>{company_name}</p>' },
  { slug: 'ticket_closed', name: 'Ticket Closed', subject: 'Ticket #{ticket_number} - Resolved', body: '<p>Dear {customer_name},</p><p>Your ticket <strong>#{ticket_number}</strong> ({ticket_title}) has been resolved.</p><p>If you need further assistance, please don\'t hesitate to reach out.</p><p>Best regards,<br>{company_name}</p>' },
];

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const templates = await prisma.emailTemplate.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { slug: 'asc' },
  });

  // Merge with defaults
  const result = DEFAULT_TEMPLATES.map(def => {
    const existing = templates.find(t => t.slug === def.slug);
    return existing || { ...def, id: null, tenantId: session.user.tenantId };
  });

  return jsonResponse({ items: result });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.slug) return errorResponse('Template slug required');

  const template = await prisma.emailTemplate.upsert({
    where: { tenantId_slug: { tenantId: session.user.tenantId, slug: body.slug } },
    update: { subject: body.subject, body: body.body, name: body.name || body.slug },
    create: {
      tenantId: session.user.tenantId,
      name: body.name || body.slug,
      slug: body.slug,
      subject: body.subject,
      body: body.body,
    },
  });

  return jsonResponse(template);
}, 'settings', 'write');
