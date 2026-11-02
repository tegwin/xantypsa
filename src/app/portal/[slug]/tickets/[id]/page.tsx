import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { closedStatusSlugs } from '@/lib/ticketStatus';
import { getPortalAccess, scopeFilter } from '@/lib/portal/access';
import { getPortalSession } from '@/lib/portal/session';
import PortalHeader from '../../PortalHeader';
import ReplyForm from './ReplyForm';

export const dynamic = 'force-dynamic';

export default async function PortalTicketPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const access = await getPortalAccess(session.contact.id, session.tenantId);

  // Scoped to the session's company, so an id from another client 404s rather
  // than leaking that it exists.
  const ticket = await prisma.ticket.findFirst({
    // Scoped the same way as the list, so a ticket id alone cannot be used to
    // read a colleague's ticket when the role only allows your own.
    where: {
      id: params.id,
      tenantId: session.tenantId,
      ...scopeFilter(access.ticketScope, session.company.id, session.contact.id),
    },
    select: {
      id: true, ticketNumber: true, title: true, description: true,
      status: true, priority: true, createdAt: true, tenantId: true,
      notes: {
        // Internal notes are staff-only and must never reach the client.
        where: { isInternal: false },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, content: true, createdAt: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!ticket) notFound();

  const closed = (await closedStatusSlugs(ticket.tenantId)).includes(ticket.status);

  return (
    <>
      <PortalHeader session={session} slug={params.slug} access={access} />

      <div className="mt-8">
        <Link
          href={`/portal/${params.slug}/tickets`}
          className="text-sm text-slate-400 hover:text-white"
        >
          ← All tickets
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{ticket.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              #{ticket.ticketNumber} · raised{' '}
              {new Date(ticket.createdAt).toLocaleDateString('en-GB')}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-white/5 px-2.5 py-1 text-xs capitalize text-slate-300">
            {ticket.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <p className="whitespace-pre-wrap text-sm text-slate-200">{ticket.description}</p>
        </div>

        {ticket.notes.length > 0 && (
          <div className="mt-6 space-y-3">
            {ticket.notes.map((n) => (
              <div key={n.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    {n.user?.name ?? 'Support'}
                  </span>
                  <span className="text-xs text-slate-600">
                    {new Date(n.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-300">{n.content}</p>
              </div>
            ))}
          </div>
        )}

        {closed ? (
          <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
            This ticket is {ticket.status}. Raise a new one if you need anything further.
          </p>
        ) : (
          <ReplyForm slug={params.slug} ticketId={ticket.id} />
        )}
      </div>
    </>
  );
}
