// ============================================================
// Referential protection
// ============================================================
// Nothing that is referenced by real work may be deleted. Deleting a contract
// that invoices and time entries point at would either orphan them or, worse,
// quietly null their link and change what the customer gets billed.
//
// The rule is the same everywhere: say what is holding the record, and how
// many, so the person knows what to clear first.

import { prisma } from './prisma';

export interface Dependency {
  /** Plural noun as it should read in the message, e.g. "invoices". */
  label: string;
  count: number;
}

/**
 * Turn a set of counts into a refusal message, or null when nothing holds it.
 *
 * "This contract is used by 3 invoices and 12 time entries. Remove them first,
 *  or deactivate the contract instead."
 */
export function describeDependencies(
  what: string,
  deps: Dependency[],
  alternative = 'Deactivate it instead if you want it out of the way.',
): string | null {
  const held = deps.filter((d) => d.count > 0);
  if (held.length === 0) return null;

  const parts = held.map((d) => `${d.count} ${d.count === 1 ? singular(d.label) : d.label}`);
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return `This ${what} is used by ${list}, so it cannot be deleted. ${alternative}`;
}

/** Crude but sufficient for the nouns used here. */
function singular(label: string): string {
  if (label.endsWith('ies')) return label.slice(0, -3) + 'y';
  if (label.endsWith('s')) return label.slice(0, -1);
  return label;
}

/**
 * What is holding a contract. Time entries and invoices are the ones that
 * matter: both carry money.
 */
export async function contractDependencies(id: string, tenantId: string): Promise<Dependency[]> {
  const [invoices, timeEntries, tickets, blocks] = await Promise.all([
    prisma.invoice.count({ where: { contractId: id, tenantId } }),
    prisma.timeEntry.count({ where: { contractId: id, tenantId } }),
    prisma.ticket.count({ where: { contractId: id, tenantId } }),
    prisma.contractHourBlock.count({ where: { contractId: id, tenantId, hoursUsed: { gt: 0 } } }),
  ]);
  return [
    { label: 'invoices', count: invoices },
    { label: 'time entries', count: timeEntries },
    { label: 'tickets', count: tickets },
    { label: 'hour blocks with time against them', count: blocks },
  ];
}

export async function companyDependencies(id: string, tenantId: string): Promise<Dependency[]> {
  const [invoices, tickets, contracts, quotes, opportunities, contacts] = await Promise.all([
    prisma.invoice.count({ where: { companyId: id, tenantId } }),
    prisma.ticket.count({ where: { companyId: id, tenantId } }),
    prisma.contract.count({ where: { companyId: id, tenantId } }),
    prisma.quote.count({ where: { companyId: id, tenantId } }),
    prisma.opportunity.count({ where: { companyId: id, tenantId } }),
    prisma.contact.count({ where: { companyId: id, tenantId } }),
  ]);
  return [
    { label: 'invoices', count: invoices },
    { label: 'tickets', count: tickets },
    { label: 'contracts', count: contracts },
    { label: 'quotes', count: quotes },
    { label: 'opportunities', count: opportunities },
    { label: 'contacts', count: contacts },
  ];
}

export async function contactDependencies(id: string, tenantId: string): Promise<Dependency[]> {
  const [tickets, opportunities, quotes] = await Promise.all([
    prisma.ticket.count({ where: { contactId: id, tenantId } }),
    prisma.opportunity.count({ where: { contactId: id, tenantId } }),
    prisma.quote.count({ where: { contactId: id, tenantId } }),
  ]);
  return [
    { label: 'tickets', count: tickets },
    { label: 'opportunities', count: opportunities },
    { label: 'quotes', count: quotes },
  ];
}

export async function billingRateDependencies(id: string, tenantId: string): Promise<Dependency[]> {
  const [timeEntries, exclusions] = await Promise.all([
    prisma.timeEntry.count({ where: { billingRateId: id, tenantId } }),
    prisma.contractExclusion.count({ where: { billingRateId: id } }),
  ]);
  return [
    { label: 'time entries', count: timeEntries },
    { label: 'contract exclusions', count: exclusions },
  ];
}

export async function productDependencies(id: string, tenantId: string): Promise<Dependency[]> {
  const [quoteItems, contractItems, invoiceItems] = await Promise.all([
    prisma.quoteItem.count({ where: { productId: id } }),
    prisma.contractItem.count({ where: { productId: id } }),
    prisma.invoiceItem.count({ where: { productId: id } }),
  ]);
  return [
    { label: 'quote lines', count: quoteItems },
    { label: 'contract lines', count: contractItems },
    { label: 'invoice lines', count: invoiceItems },
  ];
}

export async function opportunityDependencies(id: string, tenantId: string): Promise<Dependency[]> {
  const [quotes, tickets] = await Promise.all([
    prisma.quote.count({ where: { opportunityId: id, tenantId } }),
    prisma.ticket.count({ where: { opportunityId: id, tenantId } }),
  ]);
  return [
    { label: 'quotes', count: quotes },
    { label: 'tickets', count: tickets },
  ];
}

export async function projectDependencies(id: string, tenantId: string): Promise<Dependency[]> {
  const [timeEntries, tasks] = await Promise.all([
    prisma.timeEntry.count({ where: { projectId: id, tenantId } }),
    prisma.task.count({ where: { projectId: id } }),
  ]);
  return [
    { label: 'time entries', count: timeEntries },
    { label: 'tasks', count: tasks },
  ];
}
