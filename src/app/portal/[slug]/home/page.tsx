// ============================================================
// Portal home
// ============================================================
// The tiles a client lands on. Only what their role allows is shown: an area
// they cannot reach is not a disabled tile, it is simply absent.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';
import { getPortalAccess, scopeFilter } from '@/lib/portal/access';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PortalHome({ params }: { params: { slug: string } }) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const { contact, company, tenantId } = session;
  const access = await getPortalAccess(contact.id, tenantId);

  const [openTickets, quoteCount, projectCount, invoiceCount] = await Promise.all([
    access.ticketScope === 'none' ? 0 : prisma.ticket.count({
      where: { tenantId, ...scopeFilter(access.ticketScope, company.id, contact.id) },
    }),
    access.quoteScope === 'none' ? 0 : prisma.quote.count({
      where: { tenantId, ...scopeFilter(access.quoteScope, company.id, contact.id) },
    }),
    access.projectScope === 'none' ? 0 : prisma.project.count({ where: { tenantId, companyId: company.id } }),
    access.invoiceScope === 'none' ? 0 : prisma.invoice.count({ where: { tenantId, companyId: company.id } }),
  ]);

  const accent = company.portalAccent || '#1e6af5';

  const tiles = [
    access.canCreateTickets && {
      href: `/portal/${params.slug}/tickets/new`,
      title: 'Raise a ticket',
      body: 'Report a new issue or ask for something',
    },
    access.ticketScope !== 'none' && {
      href: `/portal/${params.slug}/tickets`,
      title: access.ticketScope === 'company' ? 'Tickets' : 'My tickets',
      body: `View and update your issues (${openTickets})`,
    },
    access.projectScope !== 'none' && {
      href: `/portal/${params.slug}/projects`,
      title: access.projectScope === 'company' ? 'Projects' : 'My projects',
      body: `Progress and timelines (${projectCount})`,
    },
    access.quoteScope !== 'none' && {
      href: `/portal/${params.slug}/quotes`,
      title: access.quoteScope === 'company' ? 'Quotes' : 'My quotes',
      body: `View and accept quotations (${quoteCount})`,
    },
    access.invoiceScope !== 'none' && {
      href: `/portal/${params.slug}/invoices`,
      title: 'Invoices',
      body: `Your invoices (${invoiceCount})`,
    },
    access.reportScope !== 'none' && {
      href: `/portal/${params.slug}/reports`,
      title: 'Reports',
      body: access.showBlocks ? 'Prepaid hours remaining' : 'Your reports',
    },
  ].filter(Boolean) as { href: string; title: string; body: string }[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-center text-2xl font-semibold text-white mb-2">
        {company.portalWelcome || `Welcome, how can we help you today?`}
      </h1>
      <p className="text-center text-sm text-slate-400 mb-10">
        {contact.firstName} at {company.name}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}
            className="rounded-xl bg-white p-6 text-center shadow transition-transform hover:-translate-y-0.5">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: accent }}>
              <span className="text-xl font-semibold text-white">{t.title.charAt(0)}</span>
            </span>
            <span className="block text-base font-semibold text-slate-900">{t.title}</span>
            <span className="mt-1 block text-sm text-slate-600">{t.body}</span>
          </Link>
        ))}
      </div>

      {tiles.length === 0 && (
        <p className="text-center text-sm text-slate-400">
          Your account has no areas enabled yet. Contact your IT provider.
        </p>
      )}
    </div>
  );
}
