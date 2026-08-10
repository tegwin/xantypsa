import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import ContactsClient from './ContactsClient';

export default async function ContactsPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return null;

  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({
      where: { tenantId: session.user.tenantId },
      include: { company: { select: { id: true, name: true } } },
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
