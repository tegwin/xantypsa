import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signIn, setSessionCookie } from '@/lib/auth/local';

export const dynamic = 'force-dynamic';

// Per-IP throttle. In-memory, so a restart clears it - an acceptable trade for
// not requiring Redis in a self-hosted product.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, number[]>();

function throttled(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (throttled(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  const result = await signIn(String(email), String(password));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  // The session starts without the MFA flag. If the account has TOTP, the
  // middleware sends them to /verify-2fa and only a verified code raises it.
  setSessionCookie({ userId: result.userId!, mfa: !result.mfaRequired });

  await prisma.user.update({
    where: { id: result.userId! },
    data: { lastLogin: new Date() },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, mfaRequired: result.mfaRequired });
}
