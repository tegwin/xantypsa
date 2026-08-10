import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatMoney(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export async function GET(req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  const tokenIdx = segments.indexOf('quote') + 1;
  const accessToken = segments[tokenIdx];

  const quote = await prisma.quote.findUnique({
    where: { accessToken },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      company: true,
      contact: true,
      signature: true,
    },
  });

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tenant = await prisma.tenant.findUnique({ where: { id: quote.tenantId } });

  // Generate PDF (simplified version)
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(tenant?.name || 'Quote', 14, y); y += 10;

  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`QUOTE ${quote.quoteNumber}`, 14, y); y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Title: ${quote.title}`, 14, y); y += 5;
  doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString('en-GB')}`, 14, y); y += 5;
  if (quote.validUntil) { doc.text(`Valid Until: ${new Date(quote.validUntil).toLocaleDateString('en-GB')}`, 14, y); y += 5; }
  if (quote.company) { y += 3; doc.text(`To: ${quote.company.name}`, 14, y); y += 5; }
  if (quote.contact) { doc.text(`Attn: ${quote.contact.firstName} ${quote.contact.lastName}`, 14, y); y += 8; }

  const tableData = quote.items.map((item: any) => {
    const lineNet = item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100);
    const lineTax = lineNet * (item.taxRate || 0) / 100;
    let desc = item.description;
    if (item.isOptional) desc += ' [Optional]';
    if (item.billingType === 'recurring') desc += ` [${item.billingPeriod || 'Recurring'}]`;
    return [desc, String(item.quantity), formatMoney(item.unitPrice, quote.currency), `${item.taxRate}%`, item.discount > 0 ? `${item.discount}%` : '-', formatMoney(lineNet + lineTax, quote.currency)];
  });

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Price', 'Tax', 'Disc', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Subtotal: ${formatMoney(quote.subtotal, quote.currency)}`, 140, y); y += 5;
  if (quote.discount > 0) { doc.text(`Discount: -${formatMoney(quote.discountType === 'percentage' ? quote.subtotal * quote.discount / 100 : quote.discount, quote.currency)}`, 140, y); y += 5; }
  doc.text(`Tax: ${formatMoney(quote.taxTotal, quote.currency)}`, 140, y); y += 6;
  doc.setFontSize(12);
  doc.text(`Total: ${formatMoney(quote.total, quote.currency)}`, 140, y); y += 10;

  if (quote.notes) { doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text('Notes:', 14, y); y += 4; doc.text(doc.splitTextToSize(quote.notes, 180), 14, y); y += 10; }
  if (quote.terms) { doc.text('Terms:', 14, y); y += 4; doc.text(doc.splitTextToSize(quote.terms, 180), 14, y); y += 10; }

  if (quote.signature) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Signed by: ${quote.signature.signerName} on ${new Date(quote.signature.signedAt).toLocaleDateString('en-GB')}`, 14, y);
    try { if (quote.signature.signatureData?.startsWith('data:image')) doc.addImage(quote.signature.signatureData, 'PNG', 14, y + 4, 60, 25); } catch {}
  }

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  return new Response(pdfBuffer, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${quote.quoteNumber}.pdf"` },
  });
}
