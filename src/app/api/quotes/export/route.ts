import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const format = new URL(req.url).searchParams.get('format') || 'csv';
  const tenantId = session.user.tenantId;

  const quotes = await prisma.quote.findMany({
    where: { tenantId },
    include: { company: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (format === 'csv') {
    const headers = ['Quote Number', 'Title', 'Company', 'Status', 'Subtotal', 'Tax', 'Discount', 'Total', 'Currency', 'Valid Until', 'Created', 'Created By'];
    const rows = quotes.map(q => [
      q.quoteNumber, q.title, q.company?.name || '', q.status,
      q.subtotal.toFixed(2), q.taxTotal.toFixed(2), q.discount.toFixed(2), q.total.toFixed(2),
      q.currency, q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-GB') : '',
      new Date(q.createdAt).toLocaleDateString('en-GB'), q.createdBy?.name || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="quotes-export.csv"' },
    });
  }

  return errorResponse('Unsupported format. Use ?format=csv', 400);
}, 'quotes', 'read');
