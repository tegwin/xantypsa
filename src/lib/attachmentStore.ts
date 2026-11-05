// ============================================================
// Where ticket attachments live
// ============================================================
// Supabase Storage over its REST API, so there is no new dependency and no
// blob in Postgres. The bucket is private: nothing is served from Supabase
// directly, only through this app's own authenticated route, so an attachment
// can never be read by guessing a URL.

const BUCKET = 'ticket-attachments';

function storageBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set, so attachments cannot be stored.');
  return `${url.replace(/\/$/, '')}/storage/v1`;
}

function serviceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set, so attachments cannot be stored.');
  return key;
}

function authHeaders(): Record<string, string> {
  const key = serviceKey();
  return { Authorization: `Bearer ${key}`, apikey: key };
}

/**
 * Make sure the bucket exists, and that it is private.
 *
 * Creating it on first use keeps the deployment to "set the keys" rather than
 * "set the keys, then remember this one manual step in the Supabase console".
 * An existing bucket is left exactly as it is.
 */
async function ensureBucket(): Promise<void> {
  const res = await fetch(`${storageBase()}/bucket/${BUCKET}`, { headers: authHeaders() });
  if (res.ok) return;

  await fetch(`${storageBase()}/bucket`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
  });
}

/** Keep a filename to something a storage path and a browser both accept. */
function safeName(filename: string): string {
  return (filename || 'attachment')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120);
}

/**
 * Store one file and return its path.
 *
 * Scoped by tenant then ticket, so a path alone can be checked against the
 * caller's tenant before anything is read back.
 */
export async function putAttachment(
  tenantId: string,
  ticketId: string,
  filename: string,
  contentType: string,
  content: Buffer
): Promise<string> {
  await ensureBucket();

  const path = `${tenantId}/${ticketId}/${Date.now()}-${safeName(filename)}`;
  const res = await fetch(`${storageBase()}/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: content as any,
  });

  if (!res.ok) {
    throw new Error(`Could not store attachment (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return path;
}

/** Read one back. The caller must already have checked who is asking. */
export async function getAttachment(path: string): Promise<Buffer> {
  const res = await fetch(`${storageBase()}/object/${BUCKET}/${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Could not read attachment (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Remove one. A missing file is not an error: the end state is the same. */
export async function deleteAttachment(path: string): Promise<void> {
  await fetch(`${storageBase()}/object/${BUCKET}/${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export { BUCKET as ATTACHMENT_BUCKET };
