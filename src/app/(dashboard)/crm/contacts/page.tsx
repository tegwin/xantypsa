import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import ContactsClient from './ContactsClient';

export default async function ContactsPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;

  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({
      // Prospect contacts have their own list. Keeping them out of here means
      // leads that never convert do not clog up the customer contacts.
      where: {
        tenantId: session.user.tenantId,
        OR: [
          { company: { type: { not: 'prospect' } } },
          { companyId: null },
        ],
      },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.company.findMany({
      where: { tenantId: session.user.tenantId, isActive: true, type: { not: 'prospect' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <ContactsClient
      contacts={contacts.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email || '',
        phone: c.phone || '',
        jobTitle: c.jobTitle || '',
        company: c.company?.name || '',
        companyId: c.companyId || '',
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
      }))}
      companies={companies}
    />
  );
}
