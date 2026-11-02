import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';
import { getPortalAccess, scopeFilter } from '@/lib/portal/access';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PortalQuotes({ params }: { params: { slug: string } }) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const { contact, company, tenantId } = session;
  const access = await getPortalAccess(contact.id, tenantId);
  if (access.quoteScope === 'none') redirect(`/portal/${params.slug}/home`);

  const where = scopeFilter(access.quoteScope, company.id, contact.id);
  const quotes = await prisma.quote.findMany({
    where: { tenantId, ...where },
    select: {
      id: true, quoteNumber: true, title: true, status: true,
      total: true, validUntil: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-white">Quotes</h1>

      {quotes.length === 0 ? (
        <p className="text-sm text-slate-400">No quotes yet.</p>
      ) : (
        <ul className="space-y-3">
          {quotes.map((q) => (
            <li key={q.id} className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{q.title || q.quoteNumber}</span>
                <span className="text-sm text-white">{formatCurrency(q.total)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {q.quoteNumber} - <span className="capitalize">{q.status}</span>
                {q.validUntil ? ` - valid until ${q.validUntil.toLocaleDateString('en-GB')}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-slate-500">
        To accept or reject a quote, use the link in the email it was sent with.
      </p>
    </div>
  );
}
