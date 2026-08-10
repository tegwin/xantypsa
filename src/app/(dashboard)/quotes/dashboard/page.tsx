'use client';

import { useApi } from '@/hooks/useApi';
import { PageHeader, LoadingSpinner, StatCard, StatusBadge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { BarChart3, CheckCircle, TrendingUp, DollarSign, Download } from 'lucide-react';

export default function QuoteDashboardPage() {
  const router = useRouter();
  const { data: stats, loading } = useApi<any>('/api/quotes/stats');

  if (loading) return <LoadingSpinner />;
  if (!stats) return <div className="p-8 text-slate-400">No data</div>;

  const exportCsv = () => window.open('/api/quotes/export?format=csv', '_blank');

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Quote Dashboard" subtitle="Overview of your quoting performance">
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-secondary flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Export CSV</button>
          <button onClick={() => router.push('/quotes/builder')} className="btn-primary">+ New Quote</button>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Quotes" value={stats.total} icon={<BarChart3 className="w-4 h-4" />} />
        <StatCard label="Accepted" value={stats.accepted} icon={<CheckCircle className="w-4 h-4" />} />
        <StatCard label="Conversion Rate" value={`${stats.conversionRate}%`} icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Pipeline Value" value={formatCurrency(stats.totalValue)} icon={<DollarSign className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Status */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Pipeline by Status</h3>
          <div className="space-y-3">
            {(stats.pipeline || []).map((p: any) => (
              <div key={p.status} className="flex items-center gap-3">
                <StatusBadge status={p.status} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{p.count} quotes</span>
                    <span className="text-white font-medium">{formatCurrency(p.totalValue)}</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${stats.totalValue > 0 ? (p.totalValue / stats.totalValue * 100) : 0}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Top Customers</h3>
          {(stats.topCustomers || []).length > 0 ? (
            <div className="space-y-2">
              {stats.topCustomers.map((c: any, i: number) => (
                <div key={c.companyId} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-5">{i + 1}.</span>
                    <span className="text-white text-sm">{c.companyName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{c.count} quotes</span>
                    <span className="text-white font-medium text-sm">{formatCurrency(c.totalValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No data yet</p>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="glass rounded-xl p-6 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4">Monthly Trend (Last 6 Months)</h3>
          <div className="grid grid-cols-6 gap-2">
            {(stats.monthlyTrend || []).map((m: any) => (
              <div key={m.month} className="text-center">
                <div className="h-32 flex items-end justify-center mb-2">
                  <div className="w-8 bg-brand-600 rounded-t" style={{ height: `${stats.totalValue > 0 ? Math.max(4, (m.value / Math.max(...stats.monthlyTrend.map((t: any) => t.value || 1))) * 120) : 4}px` }} />
                </div>
                <p className="text-xs text-slate-400">{m.month}</p>
                <p className="text-xs text-white font-medium">{m.count}</p>
                <p className="text-xs text-slate-400">{formatCurrency(m.value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="glass rounded-xl p-6 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-slate-400 block">Draft</span><span className="text-white text-lg font-bold">{stats.draft}</span></div>
            <div><span className="text-slate-400 block">Sent</span><span className="text-white text-lg font-bold">{stats.sent}</span></div>
            <div><span className="text-slate-400 block">Accepted Value</span><span className="text-green-400 text-lg font-bold">{formatCurrency(stats.acceptedValue)}</span></div>
            <div><span className="text-slate-400 block">Rejected</span><span className="text-red-400 text-lg font-bold">{stats.rejected}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
