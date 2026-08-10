import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import CompaniesClient from './CompaniesClient';

export default async function CompaniesPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;
  const companies = await prisma.company.findMany({
    where: { tenantId: session.user.tenantId },
    include: { _count: { select: { contacts: true, tickets: true, contracts: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return <CompaniesClient companies={companies.map((c) => ({
    id: c.id, name: c.name, type: c.type, industry: c.industry || '', phone: c.phone || '',
    email: c.email || '', website: c.website || '', city: c.city || '', isActive: c.isActive,
    contacts: c._count.contacts, tickets: c._count.tickets, contracts: c._count.contracts,
    createdAt: c.createdAt.toISOString(),
  }))} />;
}
