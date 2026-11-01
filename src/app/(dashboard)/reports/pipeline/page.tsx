'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

/**
 * The sales funnel. Open stages are drawn as a funnel, widest first; won and
 * lost are reported alongside rather than inside it.
 */
export default function PipelineReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = [from && `from=${from}`, to && `to=${to}`].filter(Boolean).join('&');
  const { data, loading } = useApi<any>(`/api/reports/pipeline${query ? `?${query}` : ''}`);

  if (loading) return <LoadingSpinner />;

  const funnel = data?.funnel || [];
  const totals = data?.totals;
  const reasons = data?.reasons || [];
  const widest = Math.max(1, ...funnel.map((s: any) => s.count));

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Sales Pipeline" subtitle="Where every open deal sits, and what it is worth">
        <div className="flex items-end gap-2">
          <label className="text-xs text-surface-400">
            From
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="block bg-surface-800 border border-surface-700 rounded px-2 py-1 text-sm text-white" />
          </label>
          <label className="text-xs text-surface-400">
            To
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="block bg-surface-800 border border-surface-700 rounded px-2 py-1 text-sm text-white" />
          </label>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">Open deals</p>
          <p className="text-xl font-semibold text-white">{totals?.openCount ?? 0}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">Pipeline value</p>
          <p className="text-xl font-semibold text-white">{formatCurrency(totals?.openValue ?? 0)}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">Weighted</p>
          <p className="text-xl font-semibold text-white">{formatCurrency(totals?.weightedValue ?? 0)}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">Won</p>
          <p className="text-xl font-semibold text-green-400">{formatCurrency(totals?.wonValue ?? 0)}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">Win rate</p>
          <p className="text-xl font-semibold text-white">{totals?.winRatePercent ?? 0}%</p>
        </div>
      </div>

      <div className="glass-panel p-6 mb-6">
        <h3 className="text-white font-semibold mb-4">Funnel</h3>
        <div className="space-y-2">
          {funnel.map((s: any) => (
            <div key={s.slug} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-surface-300 truncate">{s.name}</span>
              <div className="flex-1 bg-white/5 rounded h-8 relative overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${(s.count / widest) * 100}%`, backgroundColor: s.color, opacity: 0.75 }}
                />
                <span className="absolute inset-0 flex items-center px-3 text-xs text-white">
                  {s.count} deal{s.count === 1 ? '' : 's'}
                </span>
              </div>
              <span className="w-28 shrink-0 text-right text-sm text-white">{formatCurrency(s.value)}</span>
              <span className="w-28 shrink-0 text-right text-xs text-surface-400">
                {formatCurrency(s.weightedValue)} weighted
              </span>
            </div>
          ))}
          {funnel.length === 0 && (
            <p className="text-sm text-surface-500 py-4">
              No open stages. Add pipeline stages under Settings, CRM.
            </p>
          )}
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="glass-panel p-6">
          <h3 className="text-white font-semibold mb-4">Why deals closed</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(['win', 'loss'] as const).map(type => {
              const rows = reasons.filter((r: any) => r.type === type);
              if (rows.length === 0) return null;
              return (
                <div key={type}>
                  <h4 className="text-sm text-surface-300 mb-2 capitalize">{type} reasons</h4>
                  <ul className="space-y-1">
                    {rows.map((r: any) => (
                      <li key={r.id} className="flex justify-between text-sm py-1 border-b border-surface-800">
                        <span className="text-surface-200">{r.name}</span>
                        <span className="text-surface-400">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
