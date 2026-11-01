'use client';

import { useMemo, useState } from 'react';
import { useApi, apiPatch } from '@/hooks/useApi';
import { useBoardDnd } from '@/components/board/useBoardDnd';
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

  // Status the card has been dragged to but the server has not confirmed yet.
  // Keeps the card under the pointer instead of snapping back for a round trip.
  const [pending, setPending] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    setPending(p => ({ ...p, [quoteId]: newStatus }));
    setError(null);
    try {
      await apiPatch(`/api/quotes/${quoteId}`, { status: newStatus });
      await refetch();
    } catch {
      setError('That quote could not be moved. It has been put back.');
    } finally {
      setPending(p => {
        const next = { ...p };
        delete next[quoteId];
        return next;
      });
    }
  };

  const { cardProps, columnProps, draggingId, overColumn } = useBoardDnd(
    (quoteId, toStatus) => {
      const current = allQuotes.find(q => q.id === quoteId);
      if (current && current.status !== toStatus) handleStatusChange(quoteId, toStatus);
    },
  );

  // Flatten once so a dragged card can be regrouped without waiting for a refetch.
  const allQuotes = useMemo(() => {
    const cols = data?.columns || {};
    return STATUSES.flatMap(s =>
      (cols[s.key]?.quotes || []).map((q: any) => ({ ...q, status: s.key })),
    );
  }, [data]);

  if (loading) return <LoadingSpinner />;

  const columns = data?.columns || {};

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Quote Pipeline" subtitle="Drag a quote between columns to change its status">
        <button onClick={() => router.push('/quotes/builder')} className="btn-primary">+ New Quote</button>
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map(status => {
          const colQuotes = allQuotes.filter(
            (q: any) => (pending[q.id] ?? q.status) === status.key,
          );
          const col = {
            count: colQuotes.length,
            totalValue: colQuotes.reduce((a: number, q: any) => a + (q.total || 0), 0),
            quotes: colQuotes,
          };
          return (
            <div
              key={status.key}
              {...columnProps(status.key)}
              className={`min-w-[280px] max-w-[300px] flex-shrink-0 rounded-xl transition-shadow ${
                overColumn === status.key ? 'ring-2 ring-brand-400' : ''
              }`}
            >
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
                    {...cardProps(q.id)}
                    onClick={() => router.push(`/quotes/${q.id}`)}
                    className={`glass rounded-lg p-3 cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors ${
                      draggingId === q.id ? 'opacity-40' : ''
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-slate-400">{q.quoteNumber}</span>
                      <select
                        value={pending[q.id] ?? q.status}
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
