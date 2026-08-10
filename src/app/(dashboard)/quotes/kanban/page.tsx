'use client';

import { useApi, apiPatch } from '@/hooks/useApi';
import { PageHeader, LoadingSpinner, StatusBadge } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const STATUSES = [
  { key: 'draft', label: 'Draft', color: 'bg-slate-600' },
  { key: 'sent', label: 'Sent', color: 'bg-blue-600' },
  { key: 'viewed', label: 'Viewed', color: 'bg-cyan-600' },
  { key: 'accepted', label: 'Accepted', color: 'bg-green-600' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-600' },
  { key: 'expired', label: 'Expired', color: 'bg-amber-600' },
  { key: 'converted', label: 'Converted', color: 'bg-purple-600' },
];

export default function KanbanPage() {
  const router = useRouter();
  const { data, loading, refetch } = useApi<any>('/api/quotes/kanban');

  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    await apiPatch(`/api/quotes/${quoteId}`, { status: newStatus });
    refetch();
  };

  if (loading) return <LoadingSpinner />;

  const columns = data?.columns || {};

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Quote Pipeline" subtitle="Drag-free pipeline view of all quotes">
        <button onClick={() => router.push('/quotes/builder')} className="btn-primary">+ New Quote</button>
      </PageHeader>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map(status => {
          const col = columns[status.key] || { count: 0, totalValue: 0, quotes: [] };
          return (
            <div key={status.key} className="min-w-[280px] max-w-[300px] flex-shrink-0">
              {/* Column Header */}
              <div className={`${status.color} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">{status.label}</span>
                  <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{col.count}</span>
                </div>
                <span className="text-white/80 text-xs font-medium">{formatCurrency(col.totalValue)}</span>
              </div>

              {/* Column Body */}
              <div className="bg-white/5 rounded-b-xl p-2 space-y-2 min-h-[200px]">
                {col.quotes.length > 0 ? col.quotes.map((q: any) => (
                  <div key={q.id}
                    onClick={() => router.push(`/quotes/${q.id}`)}
                    className="glass rounded-lg p-3 cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-slate-400">{q.quoteNumber}</span>
                      <select
                        value={status.key}
                        onChange={e => { e.stopPropagation(); handleStatusChange(q.id, e.target.value); }}
                        onClick={e => e.stopPropagation()}
                        className="text-xs bg-transparent border border-slate-600 rounded px-1 py-0.5 text-slate-400"
                      >
                        {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                    <p className="text-white text-sm font-medium truncate">{q.title}</p>
                    {q.company && <p className="text-slate-400 text-xs mt-0.5">{q.company.name}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-white font-semibold text-sm">{formatCurrency(q.total)}</span>
                      {q.validUntil && <span className="text-xs text-slate-500">{formatDate(q.validUntil)}</span>}
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-xs text-slate-600 py-8">No quotes</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
