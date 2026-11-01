// ============================================================
// TOTP (RFC 6238)
// ============================================================
// Implemented on node:crypto rather than pulling in a library. The algorithm is
// small and stable, and a self-hosted product benefits from one less dependency
// in the auth path.
//
// Compatible with Microsoft Authenticator, Google Authenticator, 1Password,
// Authy and anything else that speaks otpauth://.

import crypto from 'crypto';

const DIGITS = 6;
const PERIOD = 30; // seconds
const ALGORITHM = 'sha1'; // what every authenticator app assumes

// ------------------------------------------------------------
// base32, because otpauth:// secrets are base32 and node has no built-in
// ------------------------------------------------------------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of clean) {
    const idx = B32.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character in TOTP secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ------------------------------------------------------------

/** A new random secret, base32 encoded for the authenticator app. */
export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20)); // 160 bits, the RFC's recommendation
}

/** The code for a given counter step. */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  // Counter is 64-bit big-endian. Split because bitwise ops in JS are 32-bit.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const digest = crypto.createHmac(ALGORITHM, secret).update(buf).digest();

  // Dynamic truncation, RFC 4226 §5.4.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

/** The code a correctly-configured app should be showing right now. */
export function currentCode(secretBase32: string, at = Date.now()): string {
  return hotp(base32Decode(secretBase32), Math.floor(at / 1000 / PERIOD));
}

/**
 * Check a submitted code.
 *
 * `window` allows one step either side, tolerating clock drift between the
 * phone and the server - without it, a phone a few seconds slow can never log
 * in. One step each way is the usual compromise between usability and keeping
 * the window of a stolen code short.
 */
export function verifyCode(secretBase32: string, code: string, window = 1): boolean {
  const clean = (code ?? '').replace(/\D/g, '');
  if (clean.length !== DIGITS) return false;

  const secret = base32Decode(secretBase32);
  const step = Math.floor(Date.now() / 1000 / PERIOD);

  for (let i = -window; i <= window; i++) {
    const expected = hotp(secret, step + i);
    // Constant-time: a timing difference would leak digits one at a time.
    const a = Buffer.from(expected);
    const b = Buffer.from(clean);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** The otpauth:// URI an authenticator app scans or imports. */
export function otpauthUri(secretBase32: string, account: string, issuer = 'XantyPSA'): string {
  // Issuer and account are encoded individually, but the ":" separator stays
  // literal. Encoding it as %3A is legal but some authenticators then treat the
  // whole thing as one account name and drop the issuer.
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: ALGORITHM.toUpperCase(),
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
