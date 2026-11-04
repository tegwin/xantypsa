// ============================================================
// Reading a postal address off a company's own website
// ============================================================
// No enrichment provider and no API key: most business sites already publish
// their address as schema.org JSON-LD, and the ones that do not usually put it
// in an <address> tag. Anything less reliable than those two is left alone,
// because a wrong address silently saved is worse than no address at all.

import { COUNTRIES } from './countries';

export interface LookedUpCompany {
  /** The organisation's own name, as it publishes it. */
  name?: string;
  email?: string;
  phone?: string;
  /** An absolute URL to the company's logo, taken from its own site. */
  logoUrl?: string;
  address?: LookedUpAddress;
}

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

/** The organisation's own details from JSON-LD, where it publishes them. */
function organisationFromJsonLd(html: string): Omit<LookedUpCompany, 'address'> | null {
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    let data: unknown;
    try { data = JSON.parse(block[1].trim()); } catch { continue; }
    const found = findOrganisation(data);
    if (found) return found;
  }
  return null;
}

const ORG_TYPES = ['Organization', 'Corporation', 'LocalBusiness', 'ProfessionalService'];

function findOrganisation(node: any, depth = 0): Omit<LookedUpCompany, 'address'> | null {
  if (!node || typeof node !== 'object' || depth > 6) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findOrganisation(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const type = node['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => ORG_TYPES.includes(t)) && node.name) {
    return {
      name: String(node.name).trim() || undefined,
      email: typeof node.email === 'string' ? node.email.replace(/^mailto:/i, '') : undefined,
      phone: typeof node.telephone === 'string' ? node.telephone : undefined,
    };
  }

  for (const value of Object.values(node)) {
    const found = findOrganisation(value, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * A UK postcode or a US ZIP, which is distinctive enough to anchor on.
 * Matching the postcode first and reading backwards is far more reliable than
 * trying to recognise an address line on its own.
 */
const UK_POSTCODE = /\b([A-Z]{1,2}\d[\dA-Z]?)\s?(\d[A-Z]{2})\b/;
const US_ZIP = /\b(\d{5})(?:-\d{4})?\b/;

/** Strip markup to readable lines, so text patterns can be looked for. */
function visibleLines(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|address|td|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Find an address by locating a postcode in the page text and taking the
 * line it sits on, plus the line before it.
 *
 * Only used when there is no structured data, and deliberately conservative:
 * a line that is mostly not address-shaped is ignored rather than guessed at.
 */
function addressFromText(html: string): LookedUpAddress | null {
  const lines = visibleLines(html);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A whole paragraph of prose that happens to contain a postcode is not an
    // address; a real one is short.
    if (line.length > 160) continue;

    const uk = line.match(UK_POSTCODE);
    const us = !uk && /\b[A-Z]{2}\s+\d{5}\b/.test(line) ? line.match(US_ZIP) : null;
    if (!uk && !us) continue;

    const postcode = uk ? `${uk[1]} ${uk[2]}` : us![0];
    // Everything before the postcode on the same line, plus the line above if
    // this line is only the postcode.
    let body = line.slice(0, (uk ?? us)!.index).replace(/[,\s]+$/, '').trim();
    if (body.length < 4 && i > 0 && lines[i - 1].length <= 160) body = lines[i - 1].trim();
    if (!body) continue;

    // Sites label the line in all sorts of ways; none of it is the address.
    body = body.replace(
      /^(?:registered(?:\s+office)?\s+address|registered\s+office|head\s+office|our\s+office|address|find\s+us|visit\s+us)\s*[:-]\s*/i,
      ''
    ).trim();
    if (!body) continue;

    const parts = body.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.length === 0) continue;

    // A trailing country name is the country, not the town. Without this the
    // city ends up reading "United Kingdom".
    let country = uk ? 'United Kingdom' : 'United States';
    const last = parts[parts.length - 1];
    const named = COUNTRIES.find(
      (c) => c.name.toLowerCase() === last.toLowerCase()
        || (/^(uk|gb)$/i.test(last) && c.code === 'GB')
        || (/^(usa|us)$/i.test(last) && c.code === 'US')
    );
    if (named && parts.length > 1) {
      country = named.name;
      parts.pop();
    }
    if (parts.length === 0) continue;

    return {
      address1: parts[0],
      address2: parts.length > 2 ? parts.slice(1, -1).join(', ') : undefined,
      city: parts.length > 1 ? parts[parts.length - 1] : undefined,
      postcode,
      country,
    };
  }
  return null;
}

/**
 * The company's logo, preferring what the site declares over what it merely
 * shows. Returned as an absolute URL.
 */
function logoFromHtml(html: string, pageUrl: string): string | undefined {
  const absolute = (href?: string) => {
    if (!href) return undefined;
    try { return new URL(href, pageUrl).href; } catch { return undefined; }
  };

  // schema.org says exactly which image is the logo, so it wins.
  for (const block of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const found = findLogo(JSON.parse(block[1].trim()));
      if (found) return absolute(found);
    } catch { /* malformed block; try the next */ }
  }

  // Then the social preview image, then the touch icon, then the favicon.
  const meta = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (meta) return absolute(meta[1]);

  const touch = html.match(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*apple-touch-icon[^"']*["']/i);
  if (touch) return absolute(touch[1]);

  const icon = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
  if (icon) return absolute(icon[1]);

  return undefined;
}

function findLogo(node: any, depth = 0): string | undefined {
  if (!node || typeof node !== 'object' || depth > 6) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findLogo(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (node.logo) {
    if (typeof node.logo === 'string') return node.logo;
    if (typeof node.logo?.url === 'string') return node.logo.url;
  }
  for (const value of Object.values(node)) {
    const found = findLogo(value, depth + 1);
    if (found) return found;
  }
  return undefined;
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
export async function lookupCompanyFromWebsite(website: string): Promise<LookedUpCompany | null> {
  const url = safeWebsiteUrl(website);
  if (!url) return null;

  // Try the home page, then the pages a business normally puts its address on.
  // The home page carries the name and logo; an address is more often on a
  // contact or about page, so those are tried too.
  const candidates = [
    url.href,
    new URL('/contact', url).href,
    new URL('/contact-us', url).href,
    new URL('/about', url).href,
    new URL('/about-us', url).href,
  ];

  // Built up across pages: a site may publish its name on the home page and
  // its address only on the contact page.
  const collected: LookedUpCompany = {};

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

    const org = organisationFromJsonLd(html) ?? {};
    const address = addressFromJsonLd(html) ?? addressFromAddressTag(html) ?? addressFromText(html) ?? undefined;
    const logoUrl = logoFromHtml(html, href);

    // Keep the first of everything found. The home page is tried first, so
    // its name and logo win over a contact page's.
    collected.name ??= org.name;
    collected.email ??= org.email;
    collected.phone ??= org.phone;
    collected.logoUrl ??= logoUrl;
    collected.address ??= address;

    // Stop as soon as the useful fields are all in hand rather than fetching
    // pages for nothing.
    if (collected.name && collected.address && collected.logoUrl) break;
  }

  return collected.name || collected.address || collected.logoUrl ? collected : null;
}

/** Kept for callers that only want the address. */
export async function lookupAddressFromWebsite(website: string): Promise<LookedUpAddress | null> {
  const company = await lookupCompanyFromWebsite(website);
  return company?.address ?? null;
}
