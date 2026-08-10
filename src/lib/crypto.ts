// ============================================================
// Encryption for secrets we have to store and replay
// ============================================================
// LLM provider API keys and SMTP passwords. Both are written encrypted and only
// ever decrypted server-side, immediately before the outbound call that needs
// them. Neither is ever returned to the browser.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const raw = process.env.AI_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'AI_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32'
    );
  }
  // Accept either 64 hex chars or a passphrase we hash to the right length.
  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : crypto.createHash('sha256').update(raw).digest();

  if (key.length !== KEY_LENGTH) {
    throw new Error('AI_ENCRYPTION_KEY must resolve to 32 bytes');
  }
  return key;
}

/** Encrypt a secret. Output is `iv:authTag:ciphertext`, all base64. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

/** Reverse of encryptSecret. Throws if the payload was tampered with. */
export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted secret');

  const [ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** Does this look like something encryptSecret produced? */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // All three segments are base64 and the first two are fixed-size (12-byte IV,
  // 16-byte tag), which a plaintext password is vanishingly unlikely to match.
  return (
    parts.every((p) => /^[A-Za-z0-9+/]+=*$/.test(p)) &&
    Buffer.from(parts[0], 'base64').length === IV_LENGTH &&
    Buffer.from(parts[1], 'base64').length === 16
  );
}

/**
 * Decrypt a stored secret that may predate encryption.
 *
 * Secrets written before this was introduced sit in the database as plaintext,
 * so returning them unchanged keeps existing tenants sending email. They are
 * re-encrypted the next time the settings are saved.
 */
export function decryptStoredSecret(value: string | null | undefined): string {
  if (!value) return '';
  return isEncrypted(value) ? decryptSecret(value) : value;
}

/** Safe for display: sk-ant-...4f2a */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 12) return '••••';
  return `${plaintext.slice(0, 7)}…${plaintext.slice(-4)}`;
}
