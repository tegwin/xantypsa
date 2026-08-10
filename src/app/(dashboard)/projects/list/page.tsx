'use client';

import { useState } from 'react';
import { useApi, apiPost } from '@/hooks/useApi';
import { PageHeader, DataTable, StatusBadge, Modal, Pagination, EmptyState, LoadingSpinner } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function ProjectsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { data, loading, refetch } = useApi<any>(`/api/projects?page=${page}&search=${search}&status=${statusFilter}&limit=25`);
  const { data: companiesData } = useApi<any>('/api/companies?limit=500');

  const [form, setForm] = useState({
    name: '', description: '', companyId: '', billingMethod: 'time_materials',
    budget: '', estimatedHours: '', startDate: '', endDate: '',
  });

  const statuses = ['', 'planning', 'active', 'on_hold', 'completed'];

  const handleCreate = async () => {
    const res = await apiPost('/api/projects', {
      ...form,
      budget: form.budget ? parseFloat(form.budget) : null,
      estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : null,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    });
    if (res) {
      setShowCreate(false);
      setForm({ name: '', description: '', companyId: '', billingMethod: 'time_materials', budget: '', estimatedHours: '', startDate: '', endDate: '' });
      refetch();
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Projects" subtitle="Manage project delivery and timelines">
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Project</button>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="Search projects..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input w-full max-w-md" />
          <div className="flex gap-2">
            {statuses.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${statusFilter === s ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {s ? s.replace('_', ' ') : 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? <LoadingSpinner /> : !data?.items?.length ? (
          <EmptyState title="No projects found" description="Create your first project" actionLabel="New Project" onAction={() => setShowCreate(true)} />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'name', label: 'Project', render: (r: any) => (
                  <Link href={`/projects/${r.id}`} className="text-blue-400 hover:text-blue-300 font-medium">{r.name}</Link>
                )},
                { key: 'company', label: 'Company', render: (r: any) => r.company?.name || '—' },
                { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
                { key: 'billingMethod', label: 'Billing', render: (r: any) => <span className="capitalize text-slate-300 text-xs">{r.billingMethod.replace('_', ' ')}</span> },
                { key: 'budget', label: 'Budget', render: (r: any) => r.budget ? formatCurrency(r.budget) : '—' },
                { key: 'hours', label: 'Hours', render: (r: any) => (
                  <span className={r.estimatedHours && r.actualHours > r.estimatedHours ? 'text-red-400' : 'text-slate-300'}>
                    {r.actualHours || 0}{r.estimatedHours ? `/${r.estimatedHours}` : ''}h
                  </span>
                )},
                { key: 'progress', label: 'Progress', render: (r: any) => (
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-white/10 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${r.progress || 0}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{r.progress || 0}%</span>
                  </div>
                )},
                { key: 'endDate', label: 'Deadline', render: (r: any) => (
                  <span className={r.endDate && new Date(r.endDate) < new Date() && r.status !== 'completed' ? 'text-red-400' : 'text-slate-400'}>
                    {r.endDate ? formatDate(r.endDate) : '—'}
                  </span>
                )},
              ]}
              data={data.items}
            />
            <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Project">
        <div className="space-y-4">
          <div>
            <label className="label">Project Name *</label>
            <input className="input w-full" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input w-full" rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company</label>
              <select className="input w-full" value={form.companyId} onChange={(e) => setForm({...form, companyId: e.target.value})}>
                <option value="">Select company</option>
                {companiesData?.items?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Billing Method</label>
              <select className="input w-full" value={form.billingMethod} onChange={(e) => setForm({...form, billingMethod: e.target.value})}>
                <option value="time_materials">Time & Materials</option>
                <option value="fixed">Fixed Price</option>
                <option value="retainer">Retainer</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Budget (£)</label>
              <input className="input w-full" type="number" step="0.01" value={form.budget} onChange={(e) => setForm({...form, budget: e.target.value})} />
            </div>
            <div>
              <label className="label">Estimated Hours</label>
              <input className="input w-full" type="number" value={form.estimatedHours} onChange={(e) => setForm({...form, estimatedHours: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input className="input w-full" type="date" value={form.startDate} onChange={(e) => setForm({...form, startDate: e.target.value})} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input className="input w-full" type="date" value={form.endDate} onChange={(e) => setForm({...form, endDate: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={!form.name} className="btn-primary">Create Project</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
