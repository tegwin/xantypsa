// ============================================================
// Required opportunity fields
// ============================================================
// Enforced in the server, not only the form, so the API cannot be used to get
// around what the business has decided it needs.

import { prisma } from './prisma';

export const REQUIRED_FIELDS = [
  'value', 'probability', 'source', 'expectedClose',
  'company', 'contact', 'winReason', 'lossReason',
] as const;

export type RequiredField = typeof REQUIRED_FIELDS[number];

const LABELS: Record<RequiredField, string> = {
  value: 'Value',
  probability: 'Probability',
  source: 'Source',
  expectedClose: 'Expected close date',
  company: 'Company',
  contact: 'Contact',
  winReason: 'Win reason',
  lossReason: 'Loss reason',
};

export function crmRequiredFromSettings(settings: any): Record<RequiredField, boolean> {
  const s = settings?.crmRequired || {};
  const out = {} as Record<RequiredField, boolean>;
  for (const f of REQUIRED_FIELDS) out[f] = !!s[f];
  return out;
}

export async function getCrmRequired(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return crmRequiredFromSettings(tenant?.settings);
}

/**
 * Check an opportunity against the tenant's rules.
 *
 * `record` is the values after the change, so a patch that clears a required
 * field is caught as well as a create that never set it.
 *
 * Returns a message naming everything missing, or null when it passes.
 */
export function missingFields(
  required: Record<RequiredField, boolean>,
  record: Record<string, any>,
): string | null {
  const missing: string[] = [];

  const empty = (v: any) => v === undefined || v === null || v === '' ||
    (typeof v === 'number' && Number.isNaN(v));

  if (required.value && (empty(record.value) || Number(record.value) <= 0)) missing.push(LABELS.value);
  if (required.probability && empty(record.probability)) missing.push(LABELS.probability);
  if (required.source && empty(record.source)) missing.push(LABELS.source);
  if (required.expectedClose && empty(record.expectedClose)) missing.push(LABELS.expectedClose);
  if (required.company && empty(record.companyId)) missing.push(LABELS.company);
  if (required.contact && empty(record.contactId)) missing.push(LABELS.contact);

  if (missing.length === 0) return null;
  return `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required on an opportunity.`;
}

/**
 * A reason may be required when a deal closes. Checked separately because it
 * only applies at the moment the stage becomes won or lost.
 */
export function missingCloseReason(
  required: Record<RequiredField, boolean>,
  outcome: 'won' | 'lost' | null,
  reasonId: string | null | undefined,
): string | null {
  if (!outcome) return null;
  if (outcome === 'won' && required.winReason && !reasonId) {
    return 'A win reason is required when marking a deal won.';
  }
  if (outcome === 'lost' && required.lossReason && !reasonId) {
    return 'A loss reason is required when marking a deal lost.';
  }
  return null;
}
