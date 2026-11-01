'use client';

import { useState } from 'react';
import { useApi, apiPost } from '@/hooks/useApi';
import { PageHeader, DataTable, StatusBadge, Modal, Pagination, EmptyState, LoadingSpinner, Avatar, StatCard } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function TimesheetsPage() {
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<any>(`/api/time-entries?page=${page}&limit=25${dateFrom ? `&dateFrom=${dateFrom}` : ''}${dateTo ? `&dateTo=${dateTo}` : ''}`);
  const { data: ticketsData } = useApi<any>('/api/tickets?limit=200');
  const { data: projectsData } = useApi<any>('/api/projects?limit=200');

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], hours: '', description: '',
    ticketId: '', projectId: '', billable: true, hourlyRate: '',
  });

  const handleCreate = async () => {
    const res = await apiPost('/api/time-entries', {
      ...form,
      hours: parseFloat(form.hours),
      hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
      date: new Date(form.date).toISOString(),
    });
    if (res) {
      setShowCreate(false);
      setForm({ date: new Date().toISOString().split('T')[0], hours: '', description: '', ticketId: '', projectId: '', billable: true, hourlyRate: '' });
      refetch();
    }
  };

  const totalHours = data?.items?.reduce((s: number, e: any) => s + e.hours, 0) || 0;
  const billableHours = data?.items?.filter((e: any) => e.billable).reduce((s: number, e: any) => s + e.hours, 0) || 0;
  const totalValue = data?.items?.filter((e: any) => e.billable).reduce((s: number, e: any) => s + e.hours * (e.rate || 0), 0) || 0;

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Timesheets" subtitle="Track time against tickets and projects">
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ Log Time</button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Hours" value={totalHours.toFixed(1)} subtitle="on this page" />
        <StatCard label="Billable Hours" value={billableHours.toFixed(1)} />
        <StatCard label="Billable Value" value={formatCurrency(totalValue)} />
      </div>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">From:</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="input" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">To:</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="input" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-sm text-slate-400 hover:text-white">Clear</button>
          )}
        </div>

        {loading ? <LoadingSpinner /> : !data?.items?.length ? (
          <EmptyState title="No time entries" description="Log your first time entry" actionLabel="Log Time" onAction={() => setShowCreate(true)} />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'date', label: 'Date', render: (r: any) => <span className="text-white">{formatDate(r.date)}</span> },
                { key: 'user', label: 'User', render: (r: any) => (
                  <div className="flex items-center gap-2">
                    <Avatar name={r.user?.name || 'Unknown'} size="sm" />
                    <span className="text-slate-300">{r.user?.name}</span>
                  </div>
                )},
                { key: 'description', label: 'Description', render: (r: any) => <span className="text-slate-300">{r.description || ' - '}</span> },
                { key: 'ticket', label: 'Ticket', render: (r: any) => r.ticket ? (
                  <div>
                    <span className="font-mono text-xs text-blue-400">#{r.ticket.ticketNumber}</span>
                    {r.ticket.company && <span className="text-xs text-surface-500 ml-1.5">{r.ticket.company.name}</span>}
                  </div>
                ) : ' - ' },
                { key: 'project', label: 'Project', render: (r: any) => r.project?.name || ' - ' },
                { key: 'hours', label: 'Time', render: (r: any) => (
                  <span className="text-white font-medium">{r.minutes ? `${r.minutes}m` : `${r.hours}h`}</span>
                )},
                { key: 'rate', label: 'Rate', render: (r: any) => (
                  <span className="text-surface-400 text-xs">{r.billingRate?.name || (r.billable ? 'No rate' : ' - ')}</span>
                )},
                { key: 'billable', label: 'Billable', render: (r: any) => (
                  <span className={r.billable ? 'text-green-400' : 'text-slate-500'}>{r.billable ? '✓' : '✗'}</span>
                )},
                { key: 'billed', label: 'Billed', render: (r: any) => (
                  r.billed ? <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Billed</span>
                  : r.billable ? <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Unbilled</span>
                  : <span className="text-surface-500"> - </span>
                )},
                { key: 'value', label: 'Amount', render: (r: any) => (
                  <span className="text-surface-300 font-medium">{r.billedAmount ? formatCurrency(r.billedAmount) : ' - '}</span>
                )},
              ]}
              data={data.items}
            />
            <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Log Time">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input className="input w-full" type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
            </div>
            <div>
              <label className="label">Hours *</label>
              <input className="input w-full" type="number" step="0.25" min="0.25" value={form.hours}
                onChange={(e) => setForm({...form, hours: e.target.value})} placeholder="e.g. 1.5" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input w-full" rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Ticket</label>
              <select className="input w-full" value={form.ticketId} onChange={(e) => setForm({...form, ticketId: e.target.value})}>
                <option value="">No ticket</option>
                {ticketsData?.items?.map((t: any) => <option key={t.id} value={t.id}>{t.ticketNumber} - {t.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Project</label>
              <select className="input w-full" value={form.projectId} onChange={(e) => setForm({...form, projectId: e.target.value})}>
                <option value="">No project</option>
                {projectsData?.items?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={form.billable} onChange={(e) => setForm({...form, billable: e.target.checked})} className="rounded" />
              Billable time
            </label>
            <div>
              <label className="label">Hourly Rate (£)</label>
              <input className="input w-full" type="number" step="0.01" value={form.hourlyRate}
                onChange={(e) => setForm({...form, hourlyRate: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={!form.hours || parseFloat(form.hours) <= 0} className="btn-primary">Log Time</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
