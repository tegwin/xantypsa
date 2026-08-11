import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/local';
import { IMPERSONATION_COOKIE } from '@/lib/impersonation';

export const dynamic = 'force-dynamic';

async function endSession() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  // Clear impersonation too, or signing back in resumes viewing as someone else.
  res.cookies.set(IMPERSONATION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export const POST = endSession;
export const GET = endSession;
