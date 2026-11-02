// ============================================================
// Consume a sign-in link
// ============================================================
// A GET because it is followed from an email. It sets the session cookie and
// redirects, so the token never lingers in the address bar.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { consumeLoginToken } from '@/lib/portal/magicLink';
import { encodeSession, PORTAL_COOKIE } from '@/lib/portal/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.pathname.split('/').filter(Boolean)[1];
  const token = req.nextUrl.searchParams.get('token');

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/portal/${slug}?error=${reason}`, req.nextUrl.origin));

  if (!token || !slug) return fail('invalid');

  const contact = await consumeLoginToken(token);
  if (!contact) return fail('expired');

  // The link must be used on the portal it was issued for. Without this a
  // valid token for one client could be replayed against another's URL.
  const company = await prisma.company.findFirst({
    where: {
      id: contact.companyId!,
      tenantId: contact.tenantId,
      portalSlug: slug.toLowerCase(),
      portalEnabled: true,
    },
    select: { id: true },
  });
  if (!company) return fail('invalid');

  const res = NextResponse.redirect(new URL(`/portal/${slug}/home`, req.nextUrl.origin));
  res.cookies.set(
    PORTAL_COOKIE,
    encodeSession({
      contactId: contact.id,
      companyId: company.id,
      tenantId: contact.tenantId,
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    }
  );
  return res;
}
