import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  const tokenIdx = segments.indexOf('quote') + 1;
  const accessToken = segments[tokenIdx];

  const body = await req.json();

  const quote = await prisma.quote.findUnique({ where: { accessToken } });
  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedReason: body.reason || null,
    },
  });

  return NextResponse.json({ success: true, message: 'Quote rejected' });
}
