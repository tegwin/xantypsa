import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalAccess } from '@/lib/portal/access';
import { getPortalSession } from '@/lib/portal/session';
import PortalHeader from '../../PortalHeader';
import NewTicketForm from './NewTicketForm';

export const dynamic = 'force-dynamic';

export default async function NewPortalTicketPage({ params }: { params: { slug: string } }) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const access = await getPortalAccess(session.contact.id, session.tenantId);
  if (!access.canCreateTickets) redirect(`/portal/${params.slug}/home`);

  // Colleagues to raise on behalf of. Only fetched for somebody allowed to,
  // so the list is never sent to a client who cannot use it.
  const colleagues = access.canRaiseForOthers
    ? await prisma.contact.findMany({
        where: {
          tenantId: session.tenantId,
          companyId: session.company.id,
          isActive: true,
        },
        select: { id: true, firstName: true, lastName: true, email: true },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      })
    : [];

  return (
    <>
      <PortalHeader session={session} slug={params.slug} access={access} />
      <div className="mt-8 max-w-2xl">
        <h1 className="text-xl font-semibold text-white">Raise a ticket</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tell us what is wrong and the support team will pick it up.
        </p>
        <NewTicketForm
          slug={params.slug}
          meId={session.contact.id}
          colleagues={colleagues.map((c) => ({
            id: c.id,
            name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unnamed',
          }))}
        />
      </div>
    </>
  );
}
