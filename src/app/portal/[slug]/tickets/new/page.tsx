import { redirect } from 'next/navigation';
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

  return (
    <>
      <PortalHeader session={session} slug={params.slug} access={access} />
      <div className="mt-8 max-w-2xl">
        <h1 className="text-xl font-semibold text-white">Raise a ticket</h1>
        <p className="mt-1 text-sm text-slate-400">
          Tell us what is wrong and the support team will pick it up.
        </p>
        <NewTicketForm slug={params.slug} />
      </div>
    </>
  );
}
