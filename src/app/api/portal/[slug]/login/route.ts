// ============================================================
// Request a portal sign-in link
// ============================================================
// Public and unauthenticated, so it is written defensively:
//
//   * The response never reveals whether an address is a known contact —
//     otherwise this becomes a way to enumerate a client's staff.
//   * Rate limited per company, so it cannot be used to spam someone's inbox.
//   * The link is only ever emailed, never returned in the response.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLoginToken, sendLoginEmail } from '@/lib/portal/magicLink';

export const dynamic = 'force-dynamic';

/** Deliberately identical whatever happens, to avoid leaking who exists. */
const GENERIC = {
  ok: true,
  message: 'If that address belongs to this portal, a sign-in link is on its way.',
};

// Requests per company per window. In-memory: a restart clears it, which is an
// acceptable trade for not adding a Redis dependency to a self-hosted product.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const attempts = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const slug = req.nextUrl.pathname.split('/').filter(Boolean)[2];
  const { email } = await req.json().catch(() => ({ email: null }));

  if (!slug || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json(GENERIC);
  }

  const company = await prisma.company.findFirst({
    where: { portalSlug: slug.toLowerCase(), portalEnabled: true },
    select: { id: true, name: true, tenantId: true },
  });
  if (!company) return NextResponse.json(GENERIC);

  if (rateLimited(company.id)) {
    return NextResponse.json(
      { ok: false, message: 'Too many sign-in requests. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  const contact = await prisma.contact.findFirst({
    where: {
      companyId: company.id,
      tenantId: company.tenantId,
      isActive: true,
      portalEnabled: true,
      email: { equals: email.trim().toLowerCase(), mode: 'insensitive' },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  // Unknown address: stop here, but return the same response as success.
  if (!contact?.email) return NextResponse.json(GENERIC);

  try {
    const token = await createLoginToken(
      contact.id,
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    );
    const base = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const link = `${base.replace(/\/$/, '')}/portal/${slug}/verify?token=${token}`;

    await sendLoginEmail(
      company.tenantId,
      contact.email,
      contact.firstName,
      company.name,
      link
    );
  } catch (err: any) {
    // Log for the MSP, stay generic for the caller.
    console.error('[portal] sign-in link failed:', err.message);
  }

  return NextResponse.json(GENERIC);
}
