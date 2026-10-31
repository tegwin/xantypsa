// ============================================================
// Self-contained authentication
// ============================================================
// XantyPSA authenticates its own staff: no Supabase, no external identity
// service, nothing to sign up for. `docker compose up` gives a working login.
//
// Design mirrors the client portal, which already worked this way:
//
//   * The session is a signed cookie naming a user. It is never trusted for
//     *what* that user may do — every request re-reads them from the database,
//     so deactivating someone logs them out on their next click rather than
//     whenever their token happens to expire.
//   * Passwords are bcrypt, which is already a dependency.
//   * TOTP is RFC 6238 implemented on node:crypto (see ./totp).
//
// AI_ENCRYPTION_KEY signs the cookie and encrypts TOTP secrets. Changing it
// invalidates every session and makes enrolled secrets unreadable.

import crypto from 'crypto';
import { compare, hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { encryptSecret, decryptStoredSecret } from '@/lib/crypto';
import { verifyCode } from './totp';

export const SESSION_COOKIE = 'xantypsa_session';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // a working week
const BCRYPT_ROUNDS = 12;

export interface SessionPayload {
  userId: string;
  /** Raised to true once a TOTP challenge has been passed this session. */
  mfa: boolean;
  exp: number;
}

function secret(): string {
  const raw = process.env.AI_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'AI_ENCRYPTION_KEY must be set. Generate one with: openssl rand -hex 32'
    );
  }
  return raw;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

// ------------------------------------------------------------
// Passwords
// ------------------------------------------------------------

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return compare(plain, hashed);
}

/** Minimum bar. Length beats character classes for real-world strength. */
export function validatePassword(plain: string): { ok: boolean; error?: string } {
  if (typeof plain !== 'string' || plain.length < 12) {
    return { ok: false, error: 'Use at least 12 characters.' };
  }
  if (plain.length > 200) {
    return { ok: false, error: 'That is longer than 200 characters.' };
  }
  return { ok: true };
}

// ------------------------------------------------------------
// Session cookie
// ------------------------------------------------------------

export function encodeSession(payload: Omit<SessionPayload, 'exp'>, ttl = SESSION_TTL_SECONDS): string {
  const body: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttl };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function decodeSession(raw?: string | null): SessionPayload | null {
  if (!raw) return null;

  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as SessionPayload;
    if (!payload.userId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setSessionCookie(payload: Omit<SessionPayload, 'exp'>) {
  cookies().set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
}

export function readSessionCookie(): SessionPayload | null {
  return decodeSession(cookies().get(SESSION_COOKIE)?.value);
}

// ------------------------------------------------------------
// Sign in
// ------------------------------------------------------------

/**
 * A flat shape rather than a discriminated union: this project builds with
 * `strict: false`, and without strictNullChecks TypeScript will not narrow a
 * union on a boolean discriminant, so callers get spurious errors.
 */
export interface SignInResult {
  ok: boolean;
  error?: string;
  userId?: string;
  mfaRequired?: boolean;
}

/**
 * Verify an email and password.
 *
 * Failures are deliberately indistinguishable — "unknown email" and "wrong
 * password" return the same message, and a missing user still runs a bcrypt
 * comparison so the response time does not reveal whether the account exists.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const GENERIC: SignInResult = { ok: false, error: 'Those details were not recognised.' };

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, passwordHash: true, isActive: true, totpSecret: true },
  });

  // Constant work whether or not the account exists.
  const hashToCheck =
    user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
  const matches = await verifyPassword(password, hashToCheck);

  if (!user || !user.passwordHash || !matches) return GENERIC;
  if (!user.isActive) {
    return { ok: false, error: 'This account has been deactivated.' };
  }

  return { ok: true, userId: user.id, mfaRequired: Boolean(user.totpSecret) };
}

// ------------------------------------------------------------
// Two-factor
// ------------------------------------------------------------

/** Store an enrolled secret, encrypted at rest. */
export async function enrolTotp(userId: string, secretBase32: string, code: string) {
  if (!verifyCode(secretBase32, code)) {
    return { ok: false as const, error: 'That code was not accepted. Codes change every 30 seconds.' };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encryptSecret(secretBase32), totpEnabledAt: new Date() },
  });
  return { ok: true as const };
}

export async function verifyTotpForUser(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  });
  if (!user?.totpSecret) return false;
  return verifyCode(decryptStoredSecret(user.totpSecret), code);
}

export async function disableTotp(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: null, totpEnabledAt: null },
  });
}

// ------------------------------------------------------------
// Password reset
// ------------------------------------------------------------

const RESET_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createResetToken(userId: string, requestIp?: string | null) {
  // Retire outstanding links, so an older email stops working once a new one is
  // requested.
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      requestIp: requestIp ?? null,
    },
  });
  return token;
}

/** Consume a reset token and set the new password. Single use. */
export async function consumeResetToken(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false as const, error: 'That link has expired or was already used.' };
  }

  const check = validatePassword(newPassword);
  if (!check.ok) return { ok: false as const, error: check.error! };

  // Claim first — two submissions must not both succeed.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    return { ok: false as const, error: 'That link has already been used.' };
  }

  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return { ok: true as const, userId: record.userId };
}

export { RESET_TTL_MINUTES };
