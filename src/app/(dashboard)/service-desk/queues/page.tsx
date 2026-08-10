import { getAppSession } from '@/lib/session';
import prisma from '@/lib/prisma';
import { PageHeader, Button, DataTable, Badge } from '@/components/ui';
import { Plus } from 'lucide-react';

export default async function QueuesPage() {
  const session = await getAppSession();
  if (!session?.user?.tenantId) return <div/>;
  const queues = await prisma.ticketQueue.findMany({
    where: { tenantId: session.user.tenantId },
    include: { _count: { select: { tickets: true } } },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-surface-50">Ticket Queues</h1></div></div>
      <div className="overflow-x-auto rounded-xl border border-surface-700/50">
        <table className="w-full"><thead><tr className="border-b border-surface-700/50 bg-surface-800/50">
          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase">Queue</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase">Tickets</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase">Default</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase">Status</th>
        </tr></thead><tbody className="divide-y divide-surface-700/30">
          {queues.map(q => (<tr key={q.id} className="hover:bg-surface-800/80">
            <td className="px-4 py-3 text-sm font-medium text-surface-100">{q.name}</td>
            <td className="px-4 py-3 text-sm text-surface-300">{q._count.tickets}</td>
            <td className="px-4 py-3 text-sm">{q.isDefault ? <span className="text-brand-400 text-xs font-medium">Default</span> : ''}</td>
            <td className="px-4 py-3 text-sm"><span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${q.isActive ? 'bg-green-500/15 text-green-400 ring-green-500/20' : 'bg-red-500/15 text-red-400 ring-red-500/20'}`}>{q.isActive ? 'Active' : 'Inactive'}</span></td>
          </tr>))}
        </tbody></table>
      </div>
    </div>
  );
}
