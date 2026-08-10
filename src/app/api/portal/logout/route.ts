import { NextRequest, NextResponse } from 'next/server';
import { PORTAL_COOKIE } from '@/lib/portal/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? '';
  const res = NextResponse.redirect(new URL(`/portal/${slug}`, req.nextUrl.origin));
  res.cookies.set(PORTAL_COOKIE, '', { path: '/portal', maxAge: 0 });
  return res;
}
