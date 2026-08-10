import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Routes reachable without a session.
 *
 * Deliberately an allow-list: everything not named here requires auth. The
 * previous approach enumerated *protected* prefixes, which silently left any
 * newly added module wide open.
 */
const PUBLIC_PATHS = [
  // The platform health check. Must be reachable without a session, and before
  // the Supabase client is constructed — otherwise a missing auth environment
  // variable makes the container look dead to Railway and the deploy is rolled
  // back for the wrong reason.
  '/api/health',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/auth/confirm',
  '/api/auth', // Supabase callback + sign-out handlers
  '/portal',   // client portal — its own signed session cookie, not a staff login
  // Portal endpoints. Clients are Contacts and have no Supabase session, so
  // these cannot sit behind the staff auth check. Each one authenticates
  // itself: /login is deliberately public and rate limited, the rest require a
  // portal session cookie, and /impersonate requires a *staff* session.
  '/api/portal',
];

/** Reachable once signed in but before two-factor is satisfied. */
const MFA_PATHS = ['/setup-2fa', '/verify-2fa'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Health checks short-circuit before anything else. Constructing the Supabase
  // client throws when its environment variables are absent, and a platform
  // health check that fails for want of an *auth* variable reports the
  // container as dead when the container is fine.
  if (request.nextUrl.pathname === '/api/health') {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the session cookie. Must run before any auth check, and the
  // returned response must be the one we send, or the refreshed token is lost.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    // APIs get a 401 they can handle; pages get redirected to sign in.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // ---- Two-factor enforcement -------------------------------------------
  // Supabase tracks assurance level: aal1 is password-only, aal2 means a TOTP
  // challenge has been passed. `nextLevel` is aal2 whenever the account has a
  // verified authenticator, so this covers both "must verify now" and
  // "admin requires enrolment".
  if (user && !MFA_PATHS.some((p) => pathname.startsWith(p)) && !pathname.startsWith('/api/')) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      // Enrolled but not yet challenged this session.
      const url = request.nextUrl.clone();
      url.pathname = '/verify-2fa';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // NOTE: the "must enrol" half of the policy is enforced server-side in the
    // dashboard layout, not here. Middleware has no database access, and any
    // client-supplied hint (cookie/header) could simply be deleted to bypass it.
  }

  // Signed-in users have no business on the sign-in screens.
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
