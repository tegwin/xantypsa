import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import ProspectsClient from './ProspectsClient';

/**
 * Prospects are companies that have not become customers yet. Same record as a
 * company, filtered by type, so converting one is a change of type rather than
 * a copy into another table.
 */
export default async function ProspectsPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;

  const companies = await prisma.company.findMany({
    where: { tenantId: session.user.tenantId, type: 'prospect' },
    include: {
      _count: { select: { contacts: true, opportunities: true } },
      opportunities: { select: { value: true, stage: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <ProspectsClient
      prospects={companies.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry || '',
        phone: c.phone || '',
        email: c.email || '',
        website: c.website || '',
        city: c.city || '',
        isActive: c.isActive,
        contacts: c._count.contacts,
        opportunities: c._count.opportunities,
        pipelineValue: c.opportunities.reduce((a, o) => a + (o.value || 0), 0),
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
