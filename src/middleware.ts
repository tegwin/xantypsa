import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/middleware';

const PORTAL_COOKIE = 'xantypsa_portal_v2';
const LEGACY_PORTAL_COOKIE = 'xantypsa_portal';

export async function middleware(request: NextRequest) {
  // Refreshes the Supabase session cookie and enforces the public allow-list.
  const res = await updateSession(request);

  // Portal cookies minted before the path was widened are scoped to /portal,
  // so they never reach /api/portal and every action answers "not signed in".
  // Re-issuing on any portal page repairs a stale cookie without the client
  // having to sign in again.
  // Retire the old cookie wherever it is still held. Appended as raw headers
  // because NextResponse.cookies keys by name, so setting the same name twice
  // keeps only the last one and the expiry would silently never be sent.
  if (request.cookies.get(LEGACY_PORTAL_COOKIE)) {
    for (const path of ['/portal', '/']) {
      res.headers.append(
        'set-cookie',
        `${LEGACY_PORTAL_COOKIE}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax${
          process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`,
      );
    }
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
