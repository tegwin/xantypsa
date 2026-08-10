// ============================================================
// Portal addresses
// ============================================================
// Each client gets /portal/<slug>, and picks the slug themselves. The URL
// carries no tenant, so the slug alone identifies one company — hence the
// global unique constraint in the schema.

/** Words that would collide with a real route or read as official. */
const RESERVED = new Set([
  'api', 'admin', 'login', 'logout', 'auth', 'portal', 'settings', 'quote',
  'quotes', 'invoice', 'invoices', 'ticket', 'tickets', 'support', 'help',
  'app', 'www', 'static', 'assets', 'public', 'new', 'edit', 'delete',
  'vibepsa', 'system', 'root', 'null', 'undefined', 'test',
]);

export interface SlugCheck {
  ok: boolean;
  /** The cleaned value to store when ok. */
  slug?: string;
  error?: string;
}

/**
 * Validate and normalise a client-chosen portal slug.
 *
 * Deliberately strict: it appears in a URL customers are given, and a slug that
 * differs only by case or a trailing hyphen would be a support call waiting to
 * happen.
 */
export function validateSlug(input: unknown): SlugCheck {
  if (typeof input !== 'string') return { ok: false, error: 'Enter a portal address.' };

  const slug = input.trim().toLowerCase();

  if (!slug) return { ok: false, error: 'Enter a portal address.' };
  if (slug.length < 3) return { ok: false, error: 'Must be at least 3 characters.' };
  if (slug.length > 40) return { ok: false, error: 'Must be 40 characters or fewer.' };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: 'Use only lowercase letters, numbers and hyphens.' };
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { ok: false, error: 'Cannot start or end with a hyphen.' };
  }
  if (slug.includes('--')) return { ok: false, error: 'Cannot contain two hyphens in a row.' };
  if (RESERVED.has(slug)) return { ok: false, error: `"${slug}" is reserved. Try something else.` };

  return { ok: true, slug };
}

/** A sensible starting suggestion from the company name. */
export function suggestSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
}
