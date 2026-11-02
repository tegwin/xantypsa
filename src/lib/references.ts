// ============================================================
// Reference numbers, one scheme for the whole system
// ============================================================
// Every record people quote has a reference built the same way: a prefix the
// tenant chooses, a separator, and a zero-padded sequence.
//
//   SON-00042   TKT-00042   PRJ-00007   OPP-00013
//
// The number itself is a plain per-tenant sequence. Changing a prefix changes
// how everything reads, immediately, without touching a single record.

export type RefEntity =
  | 'ticket' | 'quote' | 'invoice' | 'contract' | 'project' | 'opportunity';

export const DEFAULT_PREFIXES: Record<RefEntity, string> = {
  ticket: 'TKT',
  quote: 'QTE',
  invoice: 'INV',
  contract: 'CON',
  project: 'PRJ',
  opportunity: 'OPP',
};

export const ENTITY_LABELS: Record<RefEntity, string> = {
  ticket: 'Tickets',
  quote: 'Quotes',
  invoice: 'Invoices',
  contract: 'Contracts',
  project: 'Projects',
  opportunity: 'Opportunities',
};

export interface RefFormat {
  prefixes: Record<RefEntity, string>;
  /** Minimum digits. 5 gives 00042. */
  padding: number;
  separator: string;
}

export const DEFAULT_REF_FORMAT: RefFormat = {
  prefixes: { ...DEFAULT_PREFIXES },
  padding: 5,
  separator: '-',
};

/** Read the scheme out of the tenant settings blob, with sane fallbacks. */
export function refFormatFromSettings(settings: any): RefFormat {
  const s = settings || {};
  const prefixes = { ...DEFAULT_PREFIXES };
  for (const key of Object.keys(prefixes) as RefEntity[]) {
    const v = s.referencePrefixes?.[key];
    if (typeof v === 'string') prefixes[key] = v;
  }
  return {
    prefixes,
    padding: Number.isFinite(s.referencePadding) ? s.referencePadding : DEFAULT_REF_FORMAT.padding,
    separator: typeof s.referenceSeparator === 'string' ? s.referenceSeparator : DEFAULT_REF_FORMAT.separator,
  };
}

/**
 * Build the reference people see.
 *
 * Quotes, invoices and contracts store their reference as a finished string
 * from before this existed. Pass that string through and it is returned as it
 * is, so old records keep reading the way they always did.
 */
export function formatRef(
  entity: RefEntity,
  value: number | string | null | undefined,
  format?: Partial<RefFormat> | null,
): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;

  const f: RefFormat = {
    prefixes: { ...DEFAULT_PREFIXES, ...(format?.prefixes || {}) },
    padding: format?.padding ?? DEFAULT_REF_FORMAT.padding,
    separator: format?.separator ?? DEFAULT_REF_FORMAT.separator,
  };

  const digits = Math.max(0, Math.min(12, f.padding));
  const num = String(value).padStart(digits, '0');
  const prefix = f.prefixes[entity] ?? '';

  // An empty prefix means the number stands on its own, which some MSPs prefer.
  return prefix ? `${prefix}${f.separator}${num}` : num;
}

/**
 * The next number in a per-tenant sequence.
 *
 * Carries on from the highest number already used, but never below the start
 * the tenant has set. That lets an MSP migrating from another PSA continue
 * their existing numbering instead of restarting at one.
 */
export function nextSequenceNumber(highestUsed: number | null | undefined, startAt?: number | null): number {
  const next = (highestUsed || 0) + 1;
  const floor = startAt && startAt > 0 ? startAt : 1;
  return Math.max(next, floor);
}
