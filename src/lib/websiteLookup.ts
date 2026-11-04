// ============================================================
// Reading a postal address off a company's own website
// ============================================================
// No enrichment provider and no API key: most business sites already publish
// their address as schema.org JSON-LD, and the ones that do not usually put it
// in an <address> tag. Anything less reliable than those two is left alone,
// because a wrong address silently saved is worse than no address at all.

export interface LookedUpAddress {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

/** Full country names, since that is what the company form's dropdown stores. */
const COUNTRY_BY_CODE: Record<string, string> = {
  GB: 'United Kingdom', UK: 'United Kingdom', US: 'United States', USA: 'United States',
  IE: 'Ireland', ZA: 'South Africa', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand',
  DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands',
};

/**
 * Turn whatever the user typed into an https URL we are willing to fetch.
 *
 * Returns null for anything that is not a public web address. This is the SSRF
 * guard: the URL comes from a user, and the fetch runs on our server, so a
 * value like http://169.254.169.254/ would otherwise read cloud metadata.
 */
export function safeWebsiteUrl(input: string): URL | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase();
  // A hostname must look like a real public domain: something.tld.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || host.endsWith('.internal')) return null;
  // Literal IPs are never a company website, and are the usual SSRF vector.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return null;

  return url;
}

/** Pull the first schema.org PostalAddress out of any JSON-LD on the page. */
function addressFromJsonLd(html: string): LookedUpAddress | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue; // A malformed block is common; just try the next one.
    }

    const found = findPostalAddress(data);
    if (found) return found;
  }
  return null;
}

/** Walk the parsed JSON looking for a PostalAddress node, however it is nested. */
function findPostalAddress(node: any, depth = 0): LookedUpAddress | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findPostalAddress(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const type = node['@type'];
  const isAddress = type === 'PostalAddress'
    || (Array.isArray(type) && type.includes('PostalAddress'));

  if (isAddress) {
    const country = typeof node.addressCountry === 'object'
      ? node.addressCountry?.name
      : node.addressCountry;
    const street = String(node.streetAddress ?? '').split('\n').map((l: string) => l.trim());

    const result: LookedUpAddress = {
      address1: street[0] || undefined,
      address2: street.slice(1).filter(Boolean).join(', ') || undefined,
      city: node.addressLocality || undefined,
      state: node.addressRegion || undefined,
      postcode: node.postalCode || undefined,
      country: country ? (COUNTRY_BY_CODE[String(country).toUpperCase()] ?? String(country)) : undefined,
    };
    // A node carrying only a country tells us nothing worth prefilling.
    return result.address1 || result.city || result.postcode ? result : null;
  }

  for (const value of Object.values(node)) {
    const found = findPostalAddress(value, depth + 1);
    if (found) return found;
  }
  return null;
}

/** Last resort: the visible text of an <address> element. */
function addressFromAddressTag(html: string): LookedUpAddress | null {
  const match = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i);
  if (!match) return null;

  const lines = match[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1 && !/^(tel|phone|email|e-mail|fax)\b/i.test(l));

  if (lines.length === 0) return null;
  return {
    address1: lines[0],
    address2: lines.slice(1, -1).join(', ') || undefined,
    city: lines.length > 1 ? lines[lines.length - 1] : undefined,
  };
}

/**
 * Fetch a company website and read its postal address.
 *
 * Returns null whenever we cannot be reasonably confident, which is often:
 * plenty of sites publish no machine readable address at all.
 */
export async function lookupAddressFromWebsite(website: string): Promise<LookedUpAddress | null> {
  const url = safeWebsiteUrl(website);
  if (!url) return null;

  // Try the home page, then the pages a business normally puts its address on.
  const candidates = [url.href, new URL('/contact', url).href, new URL('/contact-us', url).href];

  for (const href of candidates) {
    let html: string;
    try {
      const res = await fetch(href, {
        redirect: 'follow',
        headers: { 'user-agent': 'XantyPSA/1.0 (company address lookup)' },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      if (!(res.headers.get('content-type') || '').includes('text/html')) continue;
      // Cap the read: we only need the markup, not a multi-megabyte page.
      html = (await res.text()).slice(0, 500_000);
    } catch {
      continue; // Unreachable, too slow, or bad TLS. Move on to the next page.
    }

    const found = addressFromJsonLd(html) ?? addressFromAddressTag(html);
    if (found) return found;
  }

  return null;
}
