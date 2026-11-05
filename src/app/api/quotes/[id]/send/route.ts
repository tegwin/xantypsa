import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getEmailTemplate, replaceTemplateVars, deliverEmail, logEmail } from '@/lib/email';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatMoney(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('quotes') + 1];
  const tenantId = session.user.tenantId;

  const quote = await prisma.quote.findFirst({
    where: { id, tenantId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      company: true,
      contact: true,
    },
  });

  if (!quote) return errorResponse('Quote not found', 404);

  // Determine recipient
  const recipientEmail = quote.contact?.email || quote.company?.email;
  if (!recipientEmail) {
    return errorResponse('No recipient email found. Add an email to the contact or company.', 400);
  }

  // Generate access token if not exists
  let accessToken = quote.accessToken;
  if (!accessToken) {
    accessToken = crypto.randomUUID();
    await prisma.quote.update({
      where: { id: quote.id },
      data: { accessToken },
    });
  }

  // Get tenant for company info
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  // Get email template
  const template = await getEmailTemplate(tenantId, 'quote_send');
  if (!template) {
    return errorResponse('Email template not found', 500);
  }

  // Build portal URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const portalLink = `${baseUrl}/portal/quote/${accessToken}`;

  // Replace template variables
  const vars: Record<string, string> = {
    quote_number: quote.quoteNumber,
    quote_title: quote.title,
    customer_name: quote.contact ? `${quote.contact.firstName} ${quote.contact.lastName}` : quote.company?.name || 'Customer',
    company_name: tenant?.name || '',
    company_email: tenant?.email || '',
    total: formatMoney(quote.total, quote.currency),
    currency_symbol: quote.currency === 'GBP' ? '£' : quote.currency === 'USD' ? '$' : quote.currency === 'EUR' ? '€' : quote.currency,
    issue_date: new Date(quote.createdAt).toLocaleDateString('en-GB'),
    expiry_date: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-GB') : 'N/A',
    quote_link: portalLink,
    notes: quote.notes || '',
  };

  const subject = replaceTemplateVars(template.subject, vars);
  const html = replaceTemplateVars(template.body, vars);

  // Generate PDF for attachment
  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(tenant?.name || 'Quote', 14, y); y += 10;
  doc.setFontSize(12);
  doc.text(`Quote ${quote.quoteNumber}`, 14, y); y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Title: ${quote.title}`, 14, y); y += 5;
  doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString('en-GB')}`, 14, y); y += 5;
  if (quote.validUntil) { doc.text(`Valid Until: ${new Date(quote.validUntil).toLocaleDateString('en-GB')}`, 14, y); y += 5; }
  if (quote.company) { doc.text(`Customer: ${quote.company.name}`, 14, y); y += 8; }

  const tableData = quote.items.map((item: any) => {
    const lineNet = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    const lineTax = lineNet * (item.taxRate || 0) / 100;
    return [item.description, String(item.quantity), formatMoney(item.unitPrice, quote.currency), `${item.taxRate}%`, formatMoney(lineNet + lineTax, quote.currency)];
  });

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Price', 'Tax', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Subtotal: ${formatMoney(quote.subtotal, quote.currency)}`, 140, y); y += 5;
  doc.text(`Tax: ${formatMoney(quote.taxTotal, quote.currency)}`, 140, y); y += 5;
  doc.setFontSize(11);
  doc.text(`Total: ${formatMoney(quote.total, quote.currency)}`, 140, y); y += 8;

  if (quote.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Notes:', 14, y); y += 4;
    doc.text(doc.splitTextToSize(quote.notes, 180), 14, y);
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  try {
    const result = await deliverEmail(tenantId, recipientEmail, subject, html, [
      { filename: `${quote.quoteNumber}.pdf`, content: pdfBuffer },
    ]);
    if (!result.sent) return errorResponse(result.reason, 400);

    // Update quote status
    await prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'sent', sentAt: new Date(), accessToken },
    });

    // Log email
    await logEmail(tenantId, quote.id, recipientEmail, subject, 'sent');

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: session.user.id,
        action: 'sent',
        entityType: 'quote',
        entityId: quote.id,
        changes: { to: recipientEmail, method: 'email' },
      },
    });

    return jsonResponse({
      success: true,
      portalLink,
      recipientEmail,
      message: `Quote sent to ${recipientEmail}`,
    });
  } catch (err: any) {
    await logEmail(tenantId, quote.id, recipientEmail, subject, 'failed', err.message);
    return errorResponse(`Failed to send email: ${err.message}`, 500);
  }
}, 'quotes', 'write');
