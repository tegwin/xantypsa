import Link from 'next/link';
import type { PortalSession } from '@/lib/portal/session';

/**
 * Portal chrome. Also carries the impersonation banner — a staff member
 * previewing the portal must never be able to forget they are not the client.
 */
export default function PortalHeader({
  session,
  slug,
}: {
  session: PortalSession;
  slug: string;
}) {
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

      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <p className="font-semibold text-white">{session.company.name}</p>
          <p className="text-xs text-slate-500">Support portal</p>
        </div>

        <nav className="flex items-center gap-5 text-sm">
          <Link href={`/portal/${slug}/tickets`} className="text-slate-400 hover:text-white">
            Tickets
          </Link>
          <Link href={`/portal/${slug}/invoices`} className="text-slate-400 hover:text-white">
            Invoices
          </Link>
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
