import { NextRequest, NextResponse } from 'next/server';
import { readSessionCookie, verifyTotpForUser, setSessionCookie } from '@/lib/auth/local';

export const dynamic = 'force-dynamic';

/**
 * The second factor at sign-in.
 *
 * Runs against the half-authenticated session set by /signin - the password is
 * already proven, this raises the session's `mfa` flag. The flag lives inside a
 * signed cookie, so a client cannot set it themselves.
 */
export async function POST(req: NextRequest) {
  const payload = readSessionCookie();
  if (!payload) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  if (payload.mfa) return NextResponse.json({ ok: true });

  const { code } = await req.json().catch(() => ({}));
  if (!code) return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });

  const valid = await verifyTotpForUser(payload.userId, String(code));
  if (!valid) {
    return NextResponse.json(
      { error: 'That code was not accepted. Codes change every 30 seconds.' },
      { status: 401 }
    );
  }

  setSessionCookie({ userId: payload.userId, mfa: true });
  return NextResponse.json({ ok: true });
}
