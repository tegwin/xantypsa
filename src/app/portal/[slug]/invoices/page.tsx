import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalAccess } from '@/lib/portal/access';
import { getPortalSession } from '@/lib/portal/session';
import { formatCurrency } from '@/lib/utils';
import PortalHeader from '../PortalHeader';

export const dynamic = 'force-dynamic';

export default async function PortalInvoicesPage({ params }: { params: { slug: string } }) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const access = await getPortalAccess(session.contact.id, session.tenantId);
  // Invoices are off by default: plenty of contacts should never see them.
  if (access.invoiceScope === 'none') redirect(`/portal/${params.slug}/home`);

  // Drafts are the MSP's working state and must not be visible to the client.
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId: session.tenantId,
      companyId: session.company.id,
      status: { notIn: ['draft', 'void'] },
      isRecurring: false,
    },
    orderBy: { issueDate: 'desc' },
    take: 100,
    select: {
      id: true, invoiceNumber: true, title: true, status: true,
      total: true, amountDue: true, issueDate: true, dueDate: true,
    },
  });

  const outstanding = invoices.reduce((sum, i) => sum + (i.amountDue ?? 0), 0);

  return (
    <>
      <PortalHeader session={session} slug={params.slug} access={access} />

      <div className="mt-8 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-white">Invoices</h1>
        {outstanding > 0 && (
          <p className="text-sm text-slate-400">
            Outstanding <span className="font-semibold text-white">{formatCurrency(outstanding)}</span>
          </p>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-slate-400">No invoices to show yet.</p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02]">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-100">
                  {inv.title || inv.invoiceNumber}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {inv.invoiceNumber}
                  {inv.dueDate && ` · due ${new Date(inv.dueDate).toLocaleDateString('en-GB')}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm text-white">{formatCurrency(inv.total)}</p>
                <p
                  className={`text-xs capitalize ${
                    (inv.amountDue ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {(inv.amountDue ?? 0) > 0 ? `${formatCurrency(inv.amountDue!)} due` : 'Paid'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
