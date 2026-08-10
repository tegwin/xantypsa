'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { PageHeader, LoadingSpinner, StatCard } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('overview');
  const { data, loading } = useApi<any>(`/api/reports?type=${reportType}`);

  const reports = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'utilization', label: 'Utilization' },
  ];

  const getTicketCount = (status: string) => {
    return data?.tickets?.find((t: any) => t.status === status)?._count || 0;
  };

  const getProjectCount = (status: string) => {
    return data?.projects?.find((p: any) => p.status === status)?._count || 0;
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Reports" subtitle="Business intelligence and analytics" />

      <div className="flex gap-2 mb-6">
        {reports.map(r => (
          <button key={r.id} onClick={() => setReportType(r.id)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${reportType === r.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {reportType === 'overview' && data && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-semibold mb-3">Tickets</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <StatCard label="New" value={getTicketCount('new')} />
                  <StatCard label="Open" value={getTicketCount('open')} />
                  <StatCard label="Pending" value={getTicketCount('pending')} />
                  <StatCard label="Resolved" value={getTicketCount('resolved')} />
                  <StatCard label="Closed" value={getTicketCount('closed')} />
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3">Projects</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Planning" value={getProjectCount('planning')} />
                  <StatCard label="Active" value={getProjectCount('active')} />
                  <StatCard label="On Hold" value={getProjectCount('on_hold')} />
                  <StatCard label="Completed" value={getProjectCount('completed')} />
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-3">Financial</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatCard label="Total Invoiced" value={formatCurrency(data.invoices?._sum?.total || 0)} />
                  <StatCard label="Total Paid" value={formatCurrency(data.invoices?._sum?.amountPaid || 0)} />
                  <StatCard label="Outstanding" value={formatCurrency((data.invoices?._sum?.total || 0) - (data.invoices?._sum?.amountPaid || 0))} />
                  <StatCard label="Total Hours Logged" value={`${(data.timeEntries?._sum?.hours || 0).toFixed(1)}h`} />
                </div>
              </div>

              <div className="glass rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3">Active Companies</h3>
                <div className="text-3xl font-bold text-white">{data.companies}</div>
              </div>
            </div>
          )}

          {reportType === 'revenue' && data && (
            <div className="space-y-6">
              <div className="glass rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Monthly Revenue</h3>
                {data.monthlyRevenue && Object.keys(data.monthlyRevenue).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(data.monthlyRevenue).map(([month, vals]: [string, any]) => (
                      <div key={month} className="flex items-center gap-4">
                        <span className="text-slate-400 w-20 text-sm">{month}</span>
                        <div className="flex-1">
                          <div className="flex gap-2 mb-1">
                            <div className="bg-blue-500/30 h-6 rounded" style={{ width: `${Math.max((vals.invoiced / Math.max(...Object.values(data.monthlyRevenue).map((v: any) => v.invoiced))) * 100, 2)}%` }}>
                              <span className="text-xs text-blue-300 px-2 leading-6">{formatCurrency(vals.invoiced)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="bg-green-500/30 h-4 rounded" style={{ width: `${Math.max((vals.paid / Math.max(...Object.values(data.monthlyRevenue).map((v: any) => v.invoiced))) * 100, 1)}%` }}>
                              <span className="text-xs text-green-300 px-2 leading-4">{formatCurrency(vals.paid)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-4 text-xs text-slate-400 pt-2">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500/30 rounded" /> Invoiced</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500/30 rounded" /> Paid</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 text-center py-8">No revenue data available</div>
                )}
              </div>
            </div>
          )}

          {reportType === 'tickets' && data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">By Status</h3>
                <div className="space-y-2">
                  {data.byStatus?.map((s: any) => (
                    <div key={s.status} className="flex items-center justify-between">
                      <span className="text-slate-300 capitalize">{s.status}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-white/10 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(s._count / Math.max(...data.byStatus.map((x: any) => x._count))) * 100}%` }} />
                        </div>
                        <span className="text-white font-medium w-8 text-right">{s._count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">By Priority</h3>
                <div className="space-y-2">
                  {data.byPriority?.map((p: any) => {
                    const colors: Record<string, string> = { low: 'bg-slate-500', medium: 'bg-blue-500', high: 'bg-amber-500', urgent: 'bg-red-500', critical: 'bg-red-600' };
                    return (
                      <div key={p.priority} className="flex items-center justify-between">
                        <span className="text-slate-300 capitalize">{p.priority}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-white/10 rounded-full h-2">
                            <div className={`${colors[p.priority] || 'bg-blue-500'} h-2 rounded-full`} style={{ width: `${(p._count / Math.max(...data.byPriority.map((x: any) => x._count))) * 100}%` }} />
                          </div>
                          <span className="text-white font-medium w-8 text-right">{p._count}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">By Type</h3>
                <div className="space-y-2">
                  {data.byType?.map((t: any) => (
                    <div key={t.type} className="flex items-center justify-between">
                      <span className="text-slate-300 capitalize">{t.type.replace('_', ' ')}</span>
                      <span className="text-white font-medium">{t._count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {reportType === 'utilization' && data && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Team Utilization (Last 30 Days)</h3>
              {data.utilization?.length ? (
                <div className="space-y-4">
                  {data.utilization.map((u: any) => (
                    <div key={u.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white font-medium">{u.name}</span>
                        <span className="text-slate-400">{u.totalHours.toFixed(1)}h total ({u.billableHours.toFixed(1)}h billable)</span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-3 flex overflow-hidden">
                        <div className="bg-green-500 h-3" style={{ width: `${u.totalHours > 0 ? (u.billableHours / 160) * 100 : 0}%` }} />
                        <div className="bg-slate-500 h-3" style={{ width: `${u.totalHours > 0 ? (u.nonBillableHours / 160) * 100 : 0}%` }} />
                      </div>
                      <div className="flex gap-4 text-xs text-slate-500">
                        <span>Billable: {u.totalHours > 0 ? ((u.billableHours / u.totalHours) * 100).toFixed(0) : 0}%</span>
                        <span>Capacity: {((u.totalHours / 160) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 text-center py-8">No time data available</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
