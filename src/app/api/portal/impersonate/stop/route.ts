import { NextRequest, NextResponse } from 'next/server';
import { PORTAL_COOKIE } from '@/lib/portal/session';

/** Drop the preview session and return the staff member to the app. */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/crm/contacts', req.nextUrl.origin));
  res.cookies.set(PORTAL_COOKIE, '', { path: '/portal', maxAge: 0 });
  return res;
}
