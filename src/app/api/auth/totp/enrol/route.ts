import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/lib/session';
import { readSessionCookie, enrolTotp, setSessionCookie } from '@/lib/auth/local';
import { generateSecret, otpauthUri } from '@/lib/auth/totp';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Hand out a fresh secret to enrol with. Not stored until a code confirms it. */
export async function GET() {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const secret = generateSecret();
  return NextResponse.json({
    secret,
    uri: otpauthUri(secret, session.user.email),
  });
}

/** Confirm the secret with a code from the app, then store it. */
export async function POST(req: NextRequest) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { secret, code } = await req.json().catch(() => ({}));
  if (!secret || !code) {
    return NextResponse.json({ error: 'A secret and a code are required.' }, { status: 400 });
  }

  const result = await enrolTotp(session.user.id, String(secret), String(code));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Enrolling proves possession, so raise this session rather than immediately
  // bouncing them to the challenge screen.
  setSessionCookie({ userId: session.user.id, mfa: true });

  return NextResponse.json({ ok: true });
}

/** Turn it off - only permitted when the admin has not mandated it. */
export async function DELETE() {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.user.mfaRequired) {
    return NextResponse.json(
      { error: 'Your administrator requires two-factor on this account.' },
      { status: 403 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null, totpEnabledAt: null },
  });
  return NextResponse.json({ ok: true });
}
