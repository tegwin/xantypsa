import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/middleware';

const PORTAL_COOKIE = 'xantypsa_portal';

export async function middleware(request: NextRequest) {
  // Refreshes the Supabase session cookie and enforces the public allow-list.
  const res = await updateSession(request);

  // Portal cookies minted before the path was widened are scoped to /portal,
  // so they never reach /api/portal and every action answers "not signed in".
  // Re-issuing on any portal page repairs a stale cookie without the client
  // having to sign in again.
  const portalCookie = request.cookies.get(PORTAL_COOKIE)?.value;
  if (portalCookie && request.nextUrl.pathname.startsWith('/portal/')) {
    // Expire the legacy one explicitly. Two cookies of the same name with
    // different paths both get sent to /portal, and the browser picks one,
    // which makes the failure look intermittent.
    res.cookies.set(PORTAL_COOKIE, '', { path: '/portal', maxAge: 0 });

    res.cookies.set(PORTAL_COOKIE, portalCookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  return res;
}

export const config = {
  /**
   * Runs on everything except static assets.
   *
   * The previous matcher enumerated protected routes, so any module added later
   * was unprotected until someone remembered to list it. Inverting it means new
   * routes are guarded by default; lib/auth/middleware.ts holds the small
   * allow-list of genuinely public paths (login, password reset, quote portal).
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
