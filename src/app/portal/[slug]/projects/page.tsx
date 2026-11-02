import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';
import { getPortalAccess } from '@/lib/portal/access';

export const dynamic = 'force-dynamic';

export default async function PortalProjects({ params }: { params: { slug: string } }) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const { contact, company, tenantId } = session;
  const access = await getPortalAccess(contact.id, tenantId);
  if (access.projectScope === 'none') redirect(`/portal/${params.slug}/home`);

  const projects = await prisma.project.findMany({
    where: { tenantId, companyId: company.id },
    select: {
      id: true, projectNumber: true, name: true, status: true,
      startDate: true, endDate: true,
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-white">Projects</h1>

      {projects.length === 0 ? (
        <p className="text-sm text-slate-400">No projects yet.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/portal/${params.slug}/projects/${p.id}`}
                className="block rounded-lg border border-slate-700 bg-slate-800/60 p-4 hover:border-slate-600">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{p.name}</span>
                  <span className="text-xs capitalize text-slate-400">{p.status?.replace(/_/g, ' ')}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {p._count.tasks} task{p._count.tasks === 1 ? '' : 's'}
                  {p.startDate ? ` - starts ${p.startDate.toLocaleDateString('en-GB')}` : ''}
                  {p.endDate ? ` - due ${p.endDate.toLocaleDateString('en-GB')}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
