// ============================================================
// Reading a company's logo off its own website
// ============================================================
// This used to try for the company's name and postal address too. Tested
// against real customer sites it found neither: small business sites rarely
// publish structured data, and a postcode scraped out of page text was as
// often wrong as right. The logo is the one thing worth having, because sites
// do declare it, so that is all this does now.


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

/** Pull a logo URL out of the markup, preferring what the site declares. */
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

/**
 * Fetch a company's home page and return its logo, or null.
 *
 * Only the home page: a site that declares no logo there will not have one on
 * /about either, and this should not spend three requests to find that out.
 */
export async function lookupLogoFromWebsite(website: string): Promise<string | null> {
  const url = safeWebsiteUrl(website);
  if (!url) return null;

  let html: string;
  try {
    const res = await fetch(url.href, {
      redirect: 'follow',
      headers: { 'user-agent': 'XantyPSA/1.0 (company logo lookup)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    if (!(res.headers.get('content-type') || '').includes('text/html')) return null;
    html = (await res.text()).slice(0, 500_000);
  } catch {
    return null; // Unreachable, too slow, or bad TLS.
  }

  return logoFromHtml(html, url.href) ?? null;
}
