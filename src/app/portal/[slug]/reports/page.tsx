// ============================================================
// Portal reports
// ============================================================
// Its own area, reached by clicking Reports, rather than numbers scattered
// across the home page. Gated by the role's report scope.

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';
import { getPortalAccess } from '@/lib/portal/access';
import { formatCurrency } from '@/lib/utils';
import PortalHeader from '../PortalHeader';

export const dynamic = 'force-dynamic';

export default async function PortalReports({ params }: { params: { slug: string } }) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const { contact, company, tenantId } = session;
  const access = await getPortalAccess(contact.id, tenantId);
  if (access.reportScope === 'none') redirect(`/portal/${params.slug}/home`);

  const accent = (company as any).portalAccent || '#1e6af5';

  const blocks = access.showBlocks
    ? await prisma.contract.findMany({
        where: { tenantId, companyId: company.id, type: 'prepay_hours', status: 'active' },
        select: {
          id: true, name: true, totalHours: true, hoursUsed: true,
          blockHourlyRate: true, overhourRate: true,
          hourBlocks: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, source: true, hours: true, hoursUsed: true, createdAt: true },
          },
        },
      })
    : [];

  return (
    <>
      <PortalHeader session={session} slug={params.slug} access={access} />

      <div className="mt-8 max-w-4xl">
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <p className="mt-1 text-sm text-slate-400">Where your time and money are going.</p>

        {!access.showBlocks && (
          <p className="mt-6 text-sm text-slate-400">
            No reports are enabled for your account yet.
          </p>
        )}

        {access.showBlocks && blocks.length === 0 && (
          <p className="mt-6 text-sm text-slate-400">
            You have no prepaid blocks of time at the moment.
          </p>
        )}

        {blocks.map((b) => {
          const purchased = b.totalHours || 0;
          const used = b.hoursUsed || 0;
          const remaining = purchased - used;
          const pct = purchased ? Math.min(100, (used / purchased) * 100) : 0;

          return (
            <section key={b.id} className="mt-6 rounded-xl border border-slate-700 bg-slate-800/60 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium text-white">{b.name}</h2>
                <span className="text-sm text-slate-400">
                  {used.toFixed(1)}h of {purchased.toFixed(1)}h used
                </span>
              </div>

              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
                <div className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: remaining <= 0 ? '#ef4444' : accent }} />
              </div>
              <p className="mt-1.5 text-right text-sm font-medium"
                style={{ color: remaining <= 0 ? '#f87171' : '#4ade80' }}>
                {remaining.toFixed(1)}h remaining
              </p>

              {b.overhourRate != null && (
                <p className="mt-2 text-xs text-slate-500">
                  Work beyond the block is charged at {formatCurrency(b.overhourRate)} an hour.
                </p>
              )}

              {b.hourBlocks.length > 0 && (
                <div className="mt-4 border-t border-slate-700 pt-4">
                  <p className="mb-2 text-xs font-medium text-slate-300">Blocks purchased</p>
                  <ul className="space-y-1">
                    {b.hourBlocks.map((hb) => (
                      <li key={hb.id} className="flex justify-between text-xs">
                        <span className="text-slate-400">
                          {hb.createdAt.toLocaleDateString('en-GB')}
                          <span className="ml-2 capitalize text-slate-500">
                            {hb.source.replace(/_/g, ' ')}
                          </span>
                        </span>
                        <span className="text-slate-300">
                          {hb.hours}h, {hb.hoursUsed}h used
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
