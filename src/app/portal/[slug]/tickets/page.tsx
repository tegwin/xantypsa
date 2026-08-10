// ============================================================
// The client's tickets
// ============================================================
// Every query here is scoped by the company id on the *session cookie*, never
// by anything in the URL or request body. A client cannot ask for another
// company's tickets because they have no way to name one.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';
import PortalHeader from '../PortalHeader';

export const dynamic = 'force-dynamic';

const STATUS_STYLE: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-300',
  open: 'bg-blue-500/15 text-blue-300',
  in_progress: 'bg-amber-500/15 text-amber-300',
  waiting: 'bg-purple-500/15 text-purple-300',
  resolved: 'bg-emerald-500/15 text-emerald-300',
  closed: 'bg-slate-500/15 text-slate-400',
};

function label(status: string) {
  return status.replace(/_/g, ' ');
}

export default async function PortalTicketsPage({ params }: { params: { slug: string } }) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const tickets = await prisma.ticket.findMany({
    where: { tenantId: session.tenantId, companyId: session.company.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, ticketNumber: true, title: true, status: true,
      priority: true, createdAt: true, updatedAt: true,
    },
  });

  const open = tickets.filter((t) => !['resolved', 'closed'].includes(t.status));
  const closed = tickets.filter((t) => ['resolved', 'closed'].includes(t.status));

  const Row = ({ t }: { t: (typeof tickets)[number] }) => (
    <Link
      href={`/portal/${params.slug}/tickets/${t.id}`}
      className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3
                 last:border-0 hover:bg-white/[0.03]"
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-100">{t.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          #{t.ticketNumber} · raised {new Date(t.createdAt).toLocaleDateString('en-GB')}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-md px-2 py-0.5 text-xs capitalize ${
          STATUS_STYLE[t.status] ?? 'bg-slate-500/15 text-slate-400'
        }`}
      >
        {label(t.status)}
      </span>
    </Link>
  );

  return (
    <>
      <PortalHeader session={session} slug={params.slug} />

      <div className="mt-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Your tickets</h1>
        <Link
          href={`/portal/${params.slug}/tickets/new`}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                     transition-colors hover:bg-brand-500"
        >
          Raise a ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-slate-400">
            You have no tickets yet. Raise one and the support team will pick it up.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Open ({open.length})
            </h2>
            <div className="rounded-xl border border-white/10 bg-white/[0.02]">
              {open.length ? (
                open.map((t) => <Row key={t.id} t={t} />)
              ) : (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  Nothing open — everything has been dealt with.
                </p>
              )}
            </div>
          </section>

          {closed.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Closed ({closed.length})
              </h2>
              <div className="rounded-xl border border-white/10 bg-white/[0.02]">
                {closed.map((t) => <Row key={t.id} t={t} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
