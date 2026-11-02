// ============================================================
// What a portal contact may see
// ============================================================
// One place decides it, so a page, its API and the navigation can never
// disagree about whether somebody is allowed something.

import { prisma } from '../prisma';

export type Scope = 'none' | 'own' | 'company';

export interface PortalAccess {
  roleName: string;
  ticketScope: Scope;
  quoteScope: Scope;
  projectScope: Scope;
  invoiceScope: Scope;
  showBlocks: boolean;
  canCreateTickets: boolean;
  canReplyTickets: boolean;
  /** Raising a ticket on behalf of a colleague needs sight of the whole company. */
  canRaiseForOthers: boolean;
}

/**
 * Nothing but their own tickets, for a tenant that has not set any roles up.
 * Deliberately the narrowest useful default: widening access should be a
 * decision somebody made, never something that happened by omission.
 */
const FALLBACK: PortalAccess = {
  roleName: 'Default',
  ticketScope: 'own',
  quoteScope: 'none',
  projectScope: 'none',
  invoiceScope: 'none',
  showBlocks: false,
  canCreateTickets: true,
  canReplyTickets: true,
  canRaiseForOthers: false,
};

export async function getPortalAccess(contactId: string, tenantId: string): Promise<PortalAccess> {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, tenantId },
    select: { portalRole: true },
  });

  const role =
    contact?.portalRole?.isActive === true
      ? contact.portalRole
      : await prisma.portalRole.findFirst({
          where: { tenantId, isDefault: true, isActive: true },
        });

  if (!role) return FALLBACK;

  return {
    roleName: role.name,
    ticketScope: role.ticketScope as Scope,
    quoteScope: role.quoteScope as Scope,
    projectScope: role.projectScope as Scope,
    invoiceScope: role.invoiceScope as Scope,
    showBlocks: role.showBlocks,
    canCreateTickets: role.canCreateTickets,
    canReplyTickets: role.canReplyTickets,
    // Company-wide sight is what makes raising for a colleague sensible: you
    // can see their tickets afterwards, so you can follow what you reported.
    canRaiseForOthers: role.canCreateTickets && role.ticketScope === 'company',
  };
}

/**
 * The `where` clause for a record type, given the scope.
 *
 * Never returns null. A nullable filter invites `{ ...filter! }`, and spreading
 * null in JavaScript yields `{}`, which silently removes the company
 * restriction instead of tightening it. "none" therefore returns a filter that
 * matches nothing, so the failure mode is an empty list rather than a leak.
 */
export function scopeFilter(
  scope: Scope,
  companyId: string,
  contactId: string,
): Record<string, any> {
  if (scope === 'none') return { companyId, id: '__no_access__' };
  if (scope === 'company') return { companyId };
  return { companyId, contactId };
}

/** True when the scope allows nothing, for callers that should not query at all. */
export function scopeAllowsNothing(scope: Scope) {
  return scope === 'none';
}
