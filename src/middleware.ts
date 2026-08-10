import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Refreshes the Supabase session cookie and enforces the public allow-list.
  return await updateSession(request);
}

export const config = {
  /**
   * Runs on everything except static assets.
   *
   * The previous matcher enumerated protected routes, so any module added later
   * was unprotected until someone remembered to list it. Inverting it means new
   * routes are guarded by default; lib/supabase/middleware.ts holds the small
   * allow-list of genuinely public paths (login, password reset, quote portal).
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
