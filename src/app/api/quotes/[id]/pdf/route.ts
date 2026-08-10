import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, errorResponse } from '@/lib/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatMoney(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

function generateQuotePDF(quote: any, tenant: any): Buffer {
  const doc = new jsPDF();
  const margin = 14;
  let y = 20;

  // Colors
  const brandColor: [number, number, number] = [59, 130, 246];
  const darkColor: [number, number, number] = [30, 41, 59];
  const textColor: [number, number, number] = [51, 65, 85];
  const mutedColor: [number, number, number] = [148, 163, 184];

  // Header - Company name
  doc.setFontSize(20);
  doc.setTextColor(...brandColor);
  doc.setFont('helvetica', 'bold');
  doc.text(tenant?.name || 'Company', margin, y);
  y += 8;

  // Company details
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.setFont('helvetica', 'normal');
  if (tenant?.email) { doc.text(tenant.email, margin, y); y += 4; }
  if (tenant?.phone) { doc.text(tenant.phone, margin, y); y += 4; }
  if (tenant?.website) { doc.text(tenant.website, margin, y); y += 4; }
  if (tenant?.address) { doc.text(tenant.address, margin, y); y += 4; }

  // Quote title
  y += 6;
  doc.setFontSize(14);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text(`QUOTE`, margin, y);
  y += 7;

  // Quote details
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);

  const detailsLeft = [
    ['Quote Number:', quote.quoteNumber],
    ['Title:', quote.title],
    ['Date:', new Date(quote.createdAt).toLocaleDateString('en-GB')],
    ['Valid Until:', quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-GB') : 'N/A'],
    ['Status:', quote.status.charAt(0).toUpperCase() + quote.status.slice(1)],
  ];

  detailsLeft.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 35, y);
    y += 5;
  });

  // Customer details
  if (quote.company) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('BILL TO', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(quote.company.name || '', margin, y); y += 4.5;
    if (quote.contact) {
      doc.text(`${quote.contact.firstName || ''} ${quote.contact.lastName || ''}`, margin, y); y += 4.5;
    }
    if (quote.company.address1) { doc.text(quote.company.address1, margin, y); y += 4.5; }
    if (quote.company.email) { doc.text(quote.company.email, margin, y); y += 4.5; }
    if (quote.company.phone) { doc.text(quote.company.phone, margin, y); y += 4.5; }
  }

  y += 6;

  // Line items table
  const tableHeaders = ['Description', 'Qty', 'Unit Price', 'Tax %', 'Disc %', 'Total'];
  const tableData = (quote.items || []).map((item: any) => {
    const lineNet = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    const lineTax = lineNet * (item.taxRate || 0) / 100;
    const lineTotal = lineNet + lineTax;
    let desc = item.description || '';
    if (item.isOptional) desc += ' [Optional]';
    if (item.billingType === 'recurring') desc += ` [${item.billingPeriod || 'Recurring'}]`;
    return [
      desc,
      String(item.quantity),
      formatMoney(item.unitPrice, quote.currency),
      `${item.taxRate || 0}%`,
      item.discount > 0 ? `${item.discount}%` : '-',
      formatMoney(lineTotal, quote.currency),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [tableHeaders],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: brandColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: textColor },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { halign: 'right', cellWidth: 15 },
      2: { halign: 'right', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Totals
  const totalsX = 140;
  doc.setFontSize(9);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textColor);
  doc.text('Subtotal:', totalsX, y);
  doc.text(formatMoney(quote.subtotal, quote.currency), 195, y, { align: 'right' }); y += 5;

  if (quote.discount > 0) {
    doc.text(`Discount (${quote.discountType === 'percentage' ? quote.discount + '%' : 'Fixed'}):`, totalsX, y);
    const discAmt = quote.discountType === 'percentage' ? quote.subtotal * quote.discount / 100 : quote.discount;
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatMoney(discAmt, quote.currency)}`, 195, y, { align: 'right' }); y += 5;
    doc.setTextColor(...textColor);
  }

  doc.text('Tax:', totalsX, y);
  doc.text(formatMoney(quote.taxTotal, quote.currency), 195, y, { align: 'right' }); y += 6;

  doc.setDrawColor(...brandColor);
  doc.line(totalsX, y - 2, 195, y - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Total:', totalsX, y + 2);
  doc.text(formatMoney(quote.total, quote.currency), 195, y + 2, { align: 'right' });
  y += 12;

  // Notes
  if (quote.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('Notes', margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    const noteLines = doc.splitTextToSize(quote.notes, 180);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4.5 + 4;
  }

  // Terms
  if (quote.terms) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('Terms & Conditions', margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    const termLines = doc.splitTextToSize(quote.terms, 180);
    doc.text(termLines, margin, y);
    y += termLines.length * 4.5 + 4;
  }

  // Signature
  if (quote.signature) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('Accepted & Signed', margin, y); y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(`Signed by: ${quote.signature.signerName}`, margin, y); y += 4.5;
    doc.text(`Date: ${new Date(quote.signature.signedAt).toLocaleDateString('en-GB')}`, margin, y); y += 4.5;
    if (quote.signature.signerEmail) {
      doc.text(`Email: ${quote.signature.signerEmail}`, margin, y); y += 4.5;
    }
    // Add signature image
    try {
      if (quote.signature.signatureData?.startsWith('data:image')) {
        doc.addImage(quote.signature.signatureData, 'PNG', margin, y, 60, 25);
      }
    } catch {}
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...mutedColor);
    doc.text(`${quote.quoteNumber} | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('quotes') + 1];

  const quote = await prisma.quote.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      company: true,
      contact: true,
      signature: true,
    },
  });

  if (!quote) return errorResponse('Quote not found', 404);

  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });

  const pdfBuffer = generateQuotePDF(quote, tenant);

  // Node Buffer isn't a valid BodyInit; Uint8Array is.
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${quote.quoteNumber}.pdf"`,
    },
  });
}, 'quotes', 'read');

