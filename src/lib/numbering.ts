// ============================================================
// Reference numbers (TKT-00001, INV-00042, …)
// ============================================================
// Split out of server-utils.ts, which reaches for next/headers and so cannot be
// imported outside a Next request — the MCP server runs as a plain Node process
// and needs this too.

import prisma from './prisma';

export type NumberedEntity = 'ticket' | 'quote' | 'invoice' | 'contract';

const PREFIXES: Record<NumberedEntity, string> = {
  ticket: 'TKT',
  quote: 'QTE',
  invoice: 'INV',
  contract: 'CON',
};

export async function getNextNumber(
  tenantId: string,
  type: NumberedEntity
): Promise<string> {
  const count = await (prisma as any)[type].count({ where: { tenantId } });
  const num = (count + 1).toString().padStart(5, '0');
  return `${PREFIXES[type]}-${num}`;
}

// ------------------------------------------------------------
// Assigning a reference to a record created outside the API routes
// ------------------------------------------------------------
// Each model spells its reference differently, and Ticket's is an integer
// sequence rather than a prefixed string. These mirror what the corresponding
// API route does, so a record created by the AI or over MCP is indistinguishable
// from one created through the UI.

const REFERENCE_FIELD: Record<string, string> = {
  Ticket: 'ticketNumber',
  Quote: 'quoteNumber',
  Invoice: 'invoiceNumber',
  Contract: 'contractNumber',
};

export function referenceField(modelName: string): string | undefined {
  return REFERENCE_FIELD[modelName];
}

/**
 * The reference field for a model, or {} if it has none or one was supplied.
 */
export async function assignReference(
  modelName: string,
  tenantId: string,
  data: Record<string, any>
): Promise<Record<string, any>> {
  const field = REFERENCE_FIELD[modelName];
  if (!field || data?.[field] != null) return {};

  if (modelName === 'Ticket') {
    // Integer sequence per tenant, taken from the highest existing number so a
    // deleted ticket cannot cause a collision.
    const last = await prisma.ticket.findFirst({
      where: { tenantId },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    return { ticketNumber: (last?.ticketNumber || 0) + 1 };
  }

  const type = modelName.toLowerCase() as NumberedEntity;
  return { [field]: await getNextNumber(tenantId, type) };
}
