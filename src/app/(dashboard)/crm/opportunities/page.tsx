import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import OpportunitiesClient from './OpportunitiesClient';

export default async function OpportunitiesPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;

  const [opportunities, companies] = await Promise.all([
    prisma.opportunity.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        owner: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.company.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <OpportunitiesClient
      opportunities={opportunities.map((d) => ({
        id: d.id, title: d.title, value: d.value, currency: d.currency, stage: d.stage,
        probability: d.probability, company: d.company?.name || '',
        contact: d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : '',
        owner: d.owner.name, expectedClose: d.expectedClose?.toISOString() || '',
        createdAt: d.createdAt.toISOString(),
      }))}
      companies={companies}
    />
  );
}
