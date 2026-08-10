// ============================================================
// The two companies every install has
// ============================================================
//   * The MSP's own company — where internal work is logged.
//   * A catch-all — where email from an unrecognised sender lands.
//
// Both are marked isSystem and cannot be deleted. Removing the catch-all would
// mean incoming email from an unknown address had nowhere to go, and the ticket
// would be dropped rather than land somewhere a human will see it.

import { PrismaClient } from '@prisma/client';

export const CATCH_ALL_NAME = 'Unassigned (Catch-All)';

/**
 * Create the system companies for a tenant if they are not already there.
 * Safe to call repeatedly — used by both the seed and new-tenant registration.
 */
export async function ensureSystemCompanies(
  prisma: PrismaClient,
  tenantId: string,
  tenantName: string,
  ownDomain?: string | null
) {
  // --- the MSP's own company ------------------------------------------
  let own = await prisma.company.findFirst({
    where: { tenantId, isSystem: true, isCatchAll: false },
  });

  if (!own) {
    // Reuse a company already named after the tenant rather than creating a
    // duplicate — installs that added themselves manually are common.
    const existing = await prisma.company.findFirst({
      where: { tenantId, name: tenantName },
    });

    own = existing
      ? await prisma.company.update({
          where: { id: existing.id },
          data: { isSystem: true, ...(ownDomain ? { emailDomains: [ownDomain] } : {}) },
        })
      : await prisma.company.create({
          data: {
            tenantId,
            name: tenantName,
            type: 'internal',
            isSystem: true,
            emailDomains: ownDomain ? [ownDomain] : [],
            notes: 'Your own organisation. Used for internal tickets and time.',
          },
        });
  }

  // --- the catch-all ----------------------------------------------------
  let catchAll = await prisma.company.findFirst({ where: { tenantId, isCatchAll: true } });

  if (!catchAll) {
    catchAll = await prisma.company.create({
      data: {
        tenantId,
        name: CATCH_ALL_NAME,
        type: 'customer',
        isSystem: true,
        isCatchAll: true,
        notes:
          'Email from an address that matches no known contact or client domain ' +
          'is filed here so it is never lost. Move those tickets to the right ' +
          'client, and add the domain to that client so it routes itself next time.',
      },
    });
  }

  return { own, catchAll };
}
