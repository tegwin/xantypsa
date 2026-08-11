import { NextRequest, NextResponse } from 'next/server';
import { consumeResetToken } from '@/lib/auth/local';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || !password) {
    return NextResponse.json({ error: 'A token and a new password are required.' }, { status: 400 });
  }

  const result = await consumeResetToken(String(token), String(password));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  // Deliberately no session here: the user signs in with the new password, which
  // confirms it works and means a leaked link cannot become a live session.
  return NextResponse.json({ ok: true });
}
