import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  const tokenIdx = segments.indexOf('quote') + 1;
  const accessToken = segments[tokenIdx];

  const body = await req.json();
  if (!body.signatureData || !body.signerName) {
    return NextResponse.json({ error: 'Signature and name are required' }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({ where: { accessToken } });
  if (!quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }
  if (quote.status === 'accepted') {
    return NextResponse.json({ error: 'Quote already accepted' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.quoteSignature.create({
      data: {
        quoteId: quote.id,
        signatureData: body.signatureData,
        signerName: body.signerName,
        signerEmail: body.signerEmail || null,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        userAgent: req.headers.get('user-agent') || null,
      },
    }),
    prisma.quote.update({
      where: { id: quote.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ success: true, message: 'Quote accepted' });
}
