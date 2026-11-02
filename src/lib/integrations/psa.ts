// ============================================================
// PSA integrations
// ============================================================
// Halo, Autotask and ConnectWise, behind one shape so the routes do not care
// which one they are talking to.
//
// Each vendor authenticates differently and none of it is guessable, so the
// required fields are declared here and checked before anything is saved. An
// integration with no credentials must never look connected.

export type PsaType = 'halopsa' | 'autotask' | 'connectwise';

export interface FieldSpec {
  key: string;
  label: string;
  required: boolean;
  secret?: boolean;
  help?: string;
}

export const PSA_FIELDS: Record<PsaType, FieldSpec[]> = {
  halopsa: [
    { key: 'apiUrl', label: 'Halo URL', required: true, help: 'e.g. https://yourco.halopsa.com' },
    { key: 'clientId', label: 'Client ID', required: true },
    { key: 'clientSecret', label: 'Client secret', required: true, secret: true },
  ],
  autotask: [
    { key: 'apiUrl', label: 'API zone URL', required: true, help: 'e.g. https://webservices16.autotask.net' },
    { key: 'apiIntegrationCode', label: 'API integration code', required: true },
    { key: 'userName', label: 'API user name', required: true },
    { key: 'secret', label: 'API secret', required: true, secret: true },
  ],
  connectwise: [
    { key: 'apiUrl', label: 'Site URL', required: true, help: 'e.g. https://api-eu.myconnectwise.net' },
    { key: 'companyId', label: 'Company ID', required: true },
    { key: 'publicKey', label: 'Public key', required: true },
    { key: 'privateKey', label: 'Private key', required: true, secret: true },
    { key: 'clientId', label: 'Client ID', required: true },
  ],
};

export function isPsaType(t: string): t is PsaType {
  return t === 'halopsa' || t === 'autotask' || t === 'connectwise';
}

/** Which required fields are missing, as labels, so the message is useful. */
export function missingFields(type: PsaType, config: Record<string, any>): string[] {
  return PSA_FIELDS[type]
    .filter((f) => f.required && !String(config?.[f.key] ?? '').trim())
    .map((f) => f.label);
}

const trimSlash = (s: string) => String(s || '').replace(/\/+$/, '');

/**
 * Halo signs in with OAuth client credentials and returns a bearer token.
 * Cached per call site rather than globally: a token is short-lived and the
 * cost of asking again is one request.
 */
async function haloToken(config: Record<string, string>): Promise<string> {
  const url = `${trimSlash(config.apiUrl)}/auth/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'all',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Halo refused the credentials (${res.status}). Check the URL, client ID and secret.`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error('Halo did not return a token.');
  return data.access_token;
}

function autotaskHeaders(config: Record<string, string>) {
  // Three static headers, not a bearer token. Getting this wrong is the usual
  // reason an Autotask integration "silently" fails.
  return {
    ApiIntegrationCode: config.apiIntegrationCode,
    UserName: config.userName,
    Secret: config.secret,
    'Content-Type': 'application/json',
  };
}

function connectwiseHeaders(config: Record<string, string>) {
  const basic = Buffer.from(
    `${config.companyId}+${config.publicKey}:${config.privateKey}`,
  ).toString('base64');
  return {
    Authorization: `Basic ${basic}`,
    clientId: config.clientId,
    'Content-Type': 'application/json',
  };
}

export interface TestResult {
  ok: boolean;
  message: string;
}

/** Ask the vendor something small and real. A saved config proves nothing. */
export async function testPsaConnection(
  type: PsaType,
  config: Record<string, string>,
): Promise<TestResult> {
  const missing = missingFields(type, config);
  if (missing.length > 0) {
    return { ok: false, message: `Missing: ${missing.join(', ')}.` };
  }

  try {
    if (type === 'halopsa') {
      const token = await haloToken(config);
      const res = await fetch(`${trimSlash(config.apiUrl)}/api/Client?count=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { ok: false, message: `Halo answered ${res.status} when listing clients.` };
      return { ok: true, message: 'Connected to Halo.' };
    }

    if (type === 'autotask') {
      const res = await fetch(
        `${trimSlash(config.apiUrl)}/atservicesrest/v1.0/Companies/query?search=${encodeURIComponent(
          JSON.stringify({ filter: [{ op: 'gte', field: 'id', value: 0 }], MaxRecords: 1 }),
        )}`,
        { headers: autotaskHeaders(config) },
      );
      if (!res.ok) {
        return { ok: false, message: `Autotask answered ${res.status}. Check the zone URL and the three credentials.` };
      }
      return { ok: true, message: 'Connected to Autotask.' };
    }

    const res = await fetch(`${trimSlash(config.apiUrl)}/v4_6_release/apis/3.0/system/info`, {
      headers: connectwiseHeaders(config),
    });
    if (!res.ok) return { ok: false, message: `ConnectWise answered ${res.status}.` };
    return { ok: true, message: 'Connected to ConnectWise.' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Could not reach the service.' };
  }
}

export interface PsaRecord {
  externalId: string;
  name: string;
  detail?: string;
}

/**
 * Read companies, contacts or tickets from the PSA.
 *
 * Deliberately read-only and capped: this is for pulling records across, not
 * for running somebody's business through an untested bridge.
 */
export async function fetchPsaRecords(
  type: PsaType,
  config: Record<string, string>,
  entity: 'companies' | 'contacts' | 'tickets',
  limit = 100,
): Promise<PsaRecord[]> {
  const base = trimSlash(config.apiUrl);

  if (type === 'halopsa') {
    const token = await haloToken(config);
    const path =
      entity === 'companies' ? `/api/Client?count=${limit}`
      : entity === 'contacts' ? `/api/Users?count=${limit}`
      : `/api/Tickets?count=${limit}`;

    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Halo answered ${res.status}`);
    const data = await res.json();

    // Halo wraps lists in a key named after the entity.
    const rows: any[] = data.clients || data.users || data.tickets || (Array.isArray(data) ? data : []);
    return rows.map((r) => ({
      externalId: String(r.id),
      name: r.name || r.summary || [r.firstname, r.surname].filter(Boolean).join(' ') || `#${r.id}`,
      detail: r.emailaddress || r.client_name || r.details || undefined,
    }));
  }

  if (type === 'autotask') {
    const map = { companies: 'Companies', contacts: 'Contacts', tickets: 'Tickets' } as const;
    const res = await fetch(
      `${base}/atservicesrest/v1.0/${map[entity]}/query?search=${encodeURIComponent(
        JSON.stringify({ filter: [{ op: 'gte', field: 'id', value: 0 }], MaxRecords: limit }),
      )}`,
      { headers: autotaskHeaders(config) },
    );
    if (!res.ok) throw new Error(`Autotask answered ${res.status}`);
    const data = await res.json();
    return (data.items || []).map((r: any) => ({
      externalId: String(r.id),
      name: r.companyName || r.title || [r.firstName, r.lastName].filter(Boolean).join(' ') || `#${r.id}`,
      detail: r.emailAddress || r.description || undefined,
    }));
  }

  const path =
    entity === 'companies' ? '/v4_6_release/apis/3.0/company/companies'
    : entity === 'contacts' ? '/v4_6_release/apis/3.0/company/contacts'
    : '/v4_6_release/apis/3.0/service/tickets';

  const res = await fetch(`${base}${path}?pageSize=${limit}`, { headers: connectwiseHeaders(config) });
  if (!res.ok) throw new Error(`ConnectWise answered ${res.status}`);
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).map((r: any) => ({
    externalId: String(r.id),
    name: r.name || r.summary || [r.firstName, r.lastName].filter(Boolean).join(' ') || `#${r.id}`,
    detail: r.defaultContact?.name || r.company?.name || undefined,
  }));
}
