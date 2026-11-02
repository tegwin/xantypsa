import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import ProspectContactsClient from './ProspectContactsClient';

/**
 * Contacts at companies that are still prospects.
 *
 * Deliberately separate from the customer contact list: a lead that never
 * converts should not clog up the people you actually do business with. The
 * records are identical, and convert along with their company.
 */
export default async function ProspectContactsPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;

  const contacts = await prisma.contact.findMany({
    where: {
      tenantId: session.user.tenantId,
      company: { type: 'prospect' },
    },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <ProspectContactsClient
      contacts={contacts.map((c) => ({
        id: c.id,
        name: [c.firstName, c.lastName].filter(Boolean).join(' '),
        email: c.email || '',
        phone: c.phone || '',
        jobTitle: c.jobTitle || '',
        companyId: c.company?.id || null,
        companyName: c.company?.name || '',
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
