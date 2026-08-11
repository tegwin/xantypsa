// ============================================================
// Session verification for the Edge runtime
// ============================================================
// Middleware runs on the Edge runtime, which has no node:crypto, no Buffer and
// no Prisma. lib/auth/local.ts uses all three, so importing it here fails at
// *runtime* with "The edge runtime does not support Node.js 'crypto' module" —
// and `next build` does not catch it.
//
// This is the same HMAC-SHA256 over the same payload, expressed in Web Crypto,
// so a cookie signed by lib/auth/local verifies here and vice versa. There is a
// test asserting the two agree; if you change one, change both.
//
// Verification only. Anything needing the database belongs in getAppSession.

export interface EdgeSessionPayload {
  userId: string;
  mfa: boolean;
  exp: number;
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Compare without leaking where two values diverge. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return bytesToBase64Url(new Uint8Array(signature));
}

/**
 * Verify a session cookie and return its payload, or null.
 *
 * Null covers every failure — absent, malformed, wrong signature, expired — so
 * a caller cannot accidentally treat "tampered" as "just needs refreshing".
 */
export async function verifySessionCookie(
  raw: string | undefined | null,
  secret: string | undefined
): Promise<EdgeSessionPayload | null> {
  if (!raw || !secret) return null;

  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return null;

  try {
    const expected = await sign(encoded, secret);
    if (!constantTimeEqual(signature, expected)) return null;

    const json = new TextDecoder().decode(base64UrlToBytes(encoded));
    const payload = JSON.parse(json) as EdgeSessionPayload;

    if (!payload?.userId || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
