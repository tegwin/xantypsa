import { cache } from 'react';
import { prisma } from './prisma';

/**
 * Which status slugs count as closed for this tenant.
 *
 * A tenant can have as many closed statuses as it likes: "Closed", "Cancelled",
 * "Duplicate", "Closed - no fault found". Any status with isClosed set marks the
 * ticket closed, so nothing in the app should compare against the slug 'closed'.
 *
 * The fallback only applies to a tenant that has not defined any statuses yet.
 *
 * `cache()` dedupes this per request. Several pages ask for it more than once,
 * and the statuses cannot change midway through rendering one.
 */
export const closedStatusSlugs = cache(async (tenantId: string): Promise<string[]> => {
  const statuses = await prisma.ticketStatus.findMany({
    where: { tenantId, isClosed: true, isActive: true },
    select: { slug: true },
  });
  if (statuses.length > 0) return statuses.map((s) => s.slug);
  return ['closed', 'resolved'];
});

export async function isClosedStatus(tenantId: string, slug: string): Promise<boolean> {
  const status = await prisma.ticketStatus.findFirst({
    where: { tenantId, slug },
    select: { isClosed: true },
  });
  if (status) return status.isClosed;
  return slug === 'closed' || slug === 'resolved';
}
