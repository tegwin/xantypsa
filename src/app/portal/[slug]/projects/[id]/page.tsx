import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';
import { getPortalAccess } from '@/lib/portal/access';
import Gantt from './Gantt';

export const dynamic = 'force-dynamic';

export default async function PortalProject({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const session = await getPortalSession();
  if (!session || session.company.portalSlug !== params.slug.toLowerCase()) {
    redirect(`/portal/${params.slug}`);
  }

  const { contact, company, tenantId } = session;
  const access = await getPortalAccess(contact.id, tenantId);
  if (access.projectScope === 'none') redirect(`/portal/${params.slug}/home`);

  // Scoped by company as well as id, so a project id alone cannot be used to
  // read another client's work.
  const project = await prisma.project.findFirst({
    where: { id: params.id, tenantId, companyId: company.id },
    select: {
      id: true, name: true, description: true, status: true,
      startDate: true, endDate: true,
      tasks: {
        // A task has a due date but no start, so the bar runs from the
        // project's start to the task's due date.
        select: { id: true, title: true, status: true, dueDate: true },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      },
      milestones: {
        select: { id: true, name: true, dueDate: true, completedAt: true },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  if (!project) notFound();

  const done = project.tasks.filter((t) => t.status === 'done').length;
  const pct = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0;
  const accent = company.portalAccent || '#1e6af5';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href={`/portal/${params.slug}/projects`} className="text-sm text-slate-400 hover:text-white">
        &larr; Projects
      </Link>

      <h1 className="mt-3 text-xl font-semibold text-white">{project.name}</h1>
      {project.description && (
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{project.description}</p>
      )}

      <div className="mt-5 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-300">Progress</span>
          <span className="text-white">{done} of {project.tasks.length} tasks done ({pct}%)</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-white">Timeline</h2>
      <Gantt
        accent={accent}
        tasks={project.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          start: project.startDate?.toISOString() ?? null,
          end: (t.dueDate ?? project.endDate)?.toISOString() ?? null,
        }))}
        milestones={project.milestones.map((m) => ({
          id: m.id,
          name: m.name,
          dueDate: m.dueDate?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
