import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

interface PDFDocumentData {
  type: 'quote' | 'invoice';
  number: string;
  title: string;
  status: string;
  date: string;
  dueDate?: string;
  validUntil?: string;
  currency: string;
  subtotal: number;
  taxTotal: number;
  discount: number;
  total: number;
  amountPaid?: number;
  amountDue?: number;
  notes?: string;
  terms?: string;
  paymentTerms?: string;
  company?: { name: string; email?: string; phone?: string; address1?: string; address2?: string; address3?: string; city?: string; postcode?: string; country?: string };
  contact?: { firstName: string; lastName: string; email?: string };
  tenant?: { name: string };
  items: LineItem[];
}

const COLORS = {
  brand: [59, 130, 246] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  text: [51, 65, 85] as [number, number, number],
  muted: [148, 163, 184] as [number, number, number],
  light: [241, 245, 249] as [number, number, number],
};

function formatCurrency(amount: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

export function generatePDF(data: PDFDocumentData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Header bar
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, pageWidth, 12, 'F');

  // Company name (from)
  y = 24;
  doc.setFontSize(20);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.text(data.tenant?.name || 'Your Company', margin, y);

  // Document type badge
  const typeLabel = data.type === 'quote' ? 'QUOTATION' : 'INVOICE';
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.brand);
  doc.setFont('helvetica', 'bold');
  doc.text(typeLabel, pageWidth - margin, y, { align: 'right' });

  // Document number
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.text(data.number, pageWidth - margin, y, { align: 'right' });

  // Horizontal rule
  y += 8;
  doc.setDrawColor(...COLORS.light);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  // Bill To / Document Details - two columns
  y += 10;
  const colWidth = contentWidth / 2;

  // Left column - Bill To
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', margin, y);

  y += 6;
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.text(data.company?.name || 'N/A', margin, y);

  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  if (data.contact) {
    doc.text(`${data.contact.firstName} ${data.contact.lastName}`, margin, y);
    y += 4.5;
  }
  if (data.company?.address1) { doc.text(data.company.address1, margin, y); y += 4.5; }
  if (data.company?.address2) { doc.text(data.company.address2, margin, y); y += 4.5; }
  if (data.company?.address3) { doc.text(data.company.address3, margin, y); y += 4.5; }
  if (data.company?.city || data.company?.postcode) {
    doc.text([data.company?.city, data.company?.postcode].filter(Boolean).join(', '), margin, y);
    y += 4.5;
  }
  if (data.company?.country) { doc.text(data.company.country, margin, y); y += 4.5; }
  if (data.company?.email) { doc.text(data.company.email, margin, y); y += 4.5; }
  if (data.company?.phone) { doc.text(data.company.phone, margin, y); y += 4.5; }

  // Right column - Document details
  let rightY = y - (data.contact ? 4.5 : 0) - (data.company?.address1 ? 4.5 : 0) - 20;
  const rightX = margin + colWidth + 10;

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILS', rightX, rightY);
  rightY += 6;

  const details: [string, string][] = [
    ['Date', data.date],
  ];
  if (data.type === 'invoice' && data.dueDate) details.push(['Due Date', data.dueDate]);
  if (data.type === 'quote' && data.validUntil) details.push(['Valid Until', data.validUntil]);
  if (data.type === 'invoice' && data.paymentTerms) details.push(['Terms', data.paymentTerms.replace('_', ' ').toUpperCase()]);
  details.push(['Status', data.status.toUpperCase()]);

  doc.setFontSize(9);
  for (const [label, value] of details) {
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.text(label, rightX, rightY);
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.text(value, rightX + 35, rightY);
    rightY += 5.5;
  }

  // Title
  y = Math.max(y, rightY) + 8;
  if (data.title) {
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.dark);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title, margin, y);
    y += 8;
  }

  // Line items table
  const tableBody = data.items.map((item) => [
    item.description,
    item.quantity.toString(),
    formatCurrency(item.unitPrice, data.currency),
    `${item.taxRate}%`,
    item.discount > 0 ? `${item.discount}%` : '-',
    formatCurrency(item.total, data.currency),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Disc.', 'Total']],
    body: tableBody,
    theme: 'plain',
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [241, 245, 249] as any,
      textColor: COLORS.muted as any,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    bodyStyles: {
      textColor: COLORS.text as any,
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] as any },
    didDrawPage: () => {
      // Footer on each page
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.muted);
      doc.text(
        `${data.tenant?.name || 'PSA'} • Generated ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    },
  });

  // Totals section
  y = (doc as any).lastAutoTable.finalY + 10;
  const totalsX = pageWidth - margin - 70;

  const totalsRows: [string, string, boolean?][] = [
    ['Subtotal', formatCurrency(data.subtotal, data.currency)],
  ];
  if (data.discount > 0) totalsRows.push(['Discount', `-${formatCurrency(data.discount, data.currency)}`]);
  totalsRows.push(['Tax', formatCurrency(data.taxTotal, data.currency)]);
  totalsRows.push(['Total', formatCurrency(data.total, data.currency), true]);
  if (data.type === 'invoice' && data.amountPaid && data.amountPaid > 0) {
    totalsRows.push(['Paid', formatCurrency(data.amountPaid, data.currency)]);
    totalsRows.push(['Amount Due', formatCurrency(data.amountDue || 0, data.currency), true]);
  }

  for (const [label, value, isBold] of totalsRows) {
    doc.setFontSize(isBold ? 11 : 9);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setTextColor(...(isBold ? COLORS.dark : COLORS.text));

    if (isBold) {
      doc.setDrawColor(...COLORS.light);
      doc.line(totalsX, y - 1, pageWidth - margin, y - 1);
      y += 2;
    }

    doc.text(label, totalsX, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += isBold ? 8 : 5.5;
  }

  // Notes
  if (data.notes) {
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    const splitNotes = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(splitNotes, margin, y);
    y += splitNotes.length * 4.5;
  }

  // Terms
  if (data.terms) {
    y += 4;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'bold');
    doc.text('TERMS & CONDITIONS', margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    const splitTerms = doc.splitTextToSize(data.terms, contentWidth);
    doc.text(splitTerms, margin, y);
  }

  return doc;
}

export function downloadPDF(data: PDFDocumentData) {
  const doc = generatePDF(data);
  doc.save(`${data.number}.pdf`);
}
