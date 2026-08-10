import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  const tokenIdx = segments.indexOf('quote') + 1;
  const accessToken = segments[tokenIdx];

  if (!accessToken) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { accessToken },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      company: { select: { name: true, email: true, phone: true, website: true } },
      contact: { select: { firstName: true, lastName: true, email: true } },
      signature: true,
    },
  });

  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  // Strip sensitive fields
  const { internalNotes, pinHash, tenantId, createdById, ...safeQuote } = quote;
  return NextResponse.json(safeQuote);
}
