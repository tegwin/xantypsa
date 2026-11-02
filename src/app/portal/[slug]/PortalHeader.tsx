import Link from 'next/link';
import type { PortalSession } from '@/lib/portal/session';
import type { PortalAccess } from '@/lib/portal/access';

/**
 * Portal chrome. Also carries the impersonation banner - a staff member
 * previewing the portal must never be able to forget they are not the client.
 */
export default function PortalHeader({
  session,
  slug,
  access,
}: {
  session: PortalSession;
  slug: string;
  access?: PortalAccess;
}) {
  const company = session.company as any;
  const accent = company.portalAccent || '#1e6af5';

  // Only what this person's role allows. An area they cannot reach is absent,
  // not shown and refused.
  const links = [
    { href: `/portal/${slug}/home`, label: 'Home', show: true },
    { href: `/portal/${slug}/tickets/new`, label: 'Raise a ticket', show: access?.canCreateTickets ?? true },
    { href: `/portal/${slug}/tickets`, label: 'Tickets', show: (access?.ticketScope ?? 'own') !== 'none' },
    { href: `/portal/${slug}/projects`, label: 'Projects', show: (access?.projectScope ?? 'none') !== 'none' },
    { href: `/portal/${slug}/quotes`, label: 'Quotes', show: (access?.quoteScope ?? 'none') !== 'none' },
    { href: `/portal/${slug}/invoices`, label: 'Invoices', show: (access?.invoiceScope ?? 'none') !== 'none' },
    { href: `/portal/${slug}/reports`, label: 'Reports', show: (access?.reportScope ?? 'none') !== 'none' },
  ].filter((l) => l.show);

  return (
    <>
      {session.impersonatedBy && (
        <div className="-mx-4 mb-6 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
          <p className="text-center text-sm text-amber-200">
            Previewing as <strong>{session.contact.firstName} {session.contact.lastName}</strong>.
            Anything you do here is recorded against you, not them.{' '}
            <Link href="/api/portal/impersonate/stop" className="underline hover:text-amber-100">
              Stop preview
            </Link>
          </p>
        </div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <Link href={`/portal/${slug}/home`} className="flex items-center gap-3">
          {company.portalLogoUrl ? (
            // The client's own logo, so the portal looks like theirs.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.portalLogoUrl} alt={session.company.name} className="h-8 w-auto" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded"
              style={{ backgroundColor: accent }}>
              <span className="text-sm font-semibold text-white">
                {session.company.name.charAt(0)}
              </span>
            </span>
          )}
          <span>
            <span className="block font-semibold text-white">{session.company.name}</span>
            <span className="block text-xs text-slate-500">Support portal</span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-5 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-slate-400 hover:text-white">
              {l.label}
            </Link>
          ))}
          <span className="text-slate-600">|</span>
          <span className="text-xs text-slate-500">{session.contact.email}</span>
          <Link
            href={`/api/portal/logout?slug=${slug}`}
            className="text-xs text-slate-400 hover:text-white"
          >
            Sign out
          </Link>
        </nav>
      </header>
    </>
  );
}
