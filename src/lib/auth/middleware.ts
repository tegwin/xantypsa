// ============================================================
// Request gate
// ============================================================
// Authentication is self-contained — a signed cookie, no external identity
// service. This runs on the edge for every request and only checks that a
// plausible session exists; what the user may actually *do* is decided
// server-side by getAppSession, which re-reads them from the database.
//
// Kept at this path so the existing import in src/middleware.ts is unchanged.

import { NextResponse, type NextRequest } from 'next/server';
// Deliberately NOT lib/auth/local: that pulls in node:crypto, Buffer and
// Prisma, none of which exist on the Edge runtime this file executes in.
import { verifySessionCookie } from '@/lib/auth/edge';

const SESSION_COOKIE = 'xantypsa_session';

/**
 * Routes reachable without a session.
 *
 * Deliberately an allow-list: everything not named here requires auth. The
 * original approach enumerated *protected* prefixes, which silently left any
 * newly added module wide open.
 */
const PUBLIC_PATHS = [
  // The platform health check. Must answer before any auth work so a missing
  // environment variable cannot make a healthy container look dead.
  '/api/health',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-2fa',
  '/api/auth',   // sign in, sign out, reset — necessarily public
  '/portal',     // client portal — its own signed session, not a staff login
  '/api/portal', // portal endpoints authenticate themselves individually
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request });

  const secret = process.env.AI_ENCRYPTION_KEY;

  if (isPublic(pathname)) {
    // Signed-in users have no business on the sign-in screens.
    const session = await verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value, secret);
    if (session?.mfa && (pathname === '/login' || pathname === '/register')) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return response;
  }

  const session = await verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value, secret);

  if (!session) {
    // APIs get a 401 they can handle; pages get sent to sign in.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Signed in with a password but the account has TOTP enrolled and this
  // session has not passed it. The cookie is signed, so `mfa` cannot be set by
  // the client — only by the server after a verified code.
  if (!session.mfa && !pathname.startsWith('/api/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/verify-2fa';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
