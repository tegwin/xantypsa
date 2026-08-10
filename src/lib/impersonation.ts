// ============================================================
// Admin impersonation
// ============================================================
// "View the app as another user" for support and troubleshooting.
//
// Design decision: the admin's own Supabase session is never swapped. Instead a
// signed cookie records who they are pretending to be, and the session resolver
// substitutes that user while keeping the real identity alongside it.
//
// That matters because:
//   * the admin can always be identified in logs — actions are attributable to
//     a real person, not an anonymous "someone was this user";
//   * stopping impersonation is deleting a cookie, not re-authenticating;
//   * no admin API call is needed to mint another user's token, so a bug here
//     cannot hand out real credentials.
//
// The cookie is HMAC-signed with AI_ENCRYPTION_KEY. Without a signature the
// cookie is just a user id, and anyone could edit it to become any user.

import crypto from 'crypto';
import { cookies } from 'next/headers';

export const IMPERSONATION_COOKIE = 'vibepsa_impersonate';

interface Payload {
  /** The user being impersonated. */
  targetUserId: string;
  /** The admin actually driving. */
  realUserId: string;
  /** Unix seconds. Impersonation always expires. */
  exp: number;
}

/** Sessions are deliberately short — this is for a support call, not a shift. */
const TTL_SECONDS = 60 * 60;

function secret(): string {
  const raw = process.env.AI_ENCRYPTION_KEY;
  if (!raw) throw new Error('AI_ENCRYPTION_KEY must be set to use impersonation');
  return raw;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

export function encodeToken(payload: Payload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

/** Returns null for anything tampered with, malformed, or expired. */
export function decodeToken(token: string | undefined): Payload | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = sign(body);
  // Constant-time compare so the signature can't be brute-forced by timing.
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as Payload;
    if (!payload.targetUserId || !payload.realUserId) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildToken(targetUserId: string, realUserId: string): string {
  return encodeToken({
    targetUserId,
    realUserId,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  });
}

/** Read the active impersonation, if any. Server-side only. */
export async function readImpersonation(): Promise<Payload | null> {
  const store = await cookies();
  return decodeToken(store.get(IMPERSONATION_COOKIE)?.value);
}

export const COOKIE_OPTIONS = {
  httpOnly: true,      // never readable from JavaScript
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: TTL_SECONDS,
};
