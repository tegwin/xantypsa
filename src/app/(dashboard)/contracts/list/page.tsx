'use client';

import { useEffect, useState } from 'react';
import { useApi, apiPost, apiPatch } from '@/hooks/useApi';
import { PageHeader, DataTable, StatusBadge, Modal, Pagination, EmptyState, LoadingSpinner } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const CONTRACT_TYPES = [
  { value: 'time_and_materials', label: 'T&M', color: 'text-slate-400' },
  { value: 'fixed_price', label: 'Fixed Price', color: 'text-blue-400' },
  { value: 'prepay_hours', label: 'Pre-Pay Hours', color: 'text-purple-400' },
  { value: 'managed_service', label: 'Monthly Service', color: 'text-green-400' },
];

export default function ContractsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { data, loading, refetch } = useApi<any>(`/api/contracts?page=${page}&search=${search}&status=${statusFilter}&type=${typeFilter}&limit=25`);
  const { data: companiesData } = useApi<any>('/api/companies?limit=500');
  const { data: ratesData } = useApi<any>('/api/billing-rates');

  const defaultForm = {
    name: '', companyId: '', type: 'time_and_materials',
    startDate: new Date().toISOString().split('T')[0], endDate: '',
    billingCycle: 'monthly', notes: '', description: '',
    // fixed_price
    fixedPrice: '', billingMode: 'one_off', instalmentCount: '1',
    // prepay_hours
    totalHours: '', overhourRate: '', alertThreshold: '80', value: '',
    blockMode: 'one_off', blockHourlyRate: '', hoursPerPeriod: '',
    carryOver: false, carryOverMaxHours: '', autoTopUp: false,
    topUpThresholdHours: '', topUpHours: '',
    // managed_service
    monthlyFee: '',
    // exclusions
    excludedRateIds: [] as string[],
    // milestone details
    milestones: [] as { description: string; amount: string; dueDate: string }[],
    // products/services that price the contract
    items: [] as { description: string; quantity: number; unitPrice: number; cost: number; taxRate: number; recurring: boolean }[],
    // raise the recurring invoice as soon as the contract is created
    createInvoice: true,
  };
  const [form, setForm] = useState(defaultForm);

  // Generate default milestones when instalment count or fixed price changes
  const generateDefaultMilestones = (count: number, total: number, startDate: string, cycle: string) => {
    const milestones = [];
    const perAmount = total / count;
    const start = new Date(startDate || new Date().toISOString().split('T')[0]);
    for (let i = 0; i < count; i++) {
      const dueDate = new Date(start);
      if (cycle === 'monthly') dueDate.setMonth(dueDate.getMonth() + i);
      else if (cycle === 'quarterly') dueDate.setMonth(dueDate.getMonth() + i * 3);
      else dueDate.setMonth(dueDate.getMonth() + i);
      milestones.push({
        description: `Milestone ${i + 1}`,
        amount: perAmount.toFixed(2),
        dueDate: dueDate.toISOString().split('T')[0],
      });
    }
    return milestones;
  };

  const updateMilestone = (index: number, field: string, value: string) => {
    setForm(f => {
      const milestones = [...f.milestones];
      milestones[index] = { ...milestones[index], [field]: value };
      return { ...f, milestones };
    });
  };

  const addItem = () =>
    setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unitPrice: 0, cost: 0, taxRate: 20, recurring: true }] }));

  const updateItem = (idx: number, patch: any) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const removeItem = (idx: number) =>
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  // The contract's value is the NET total of its lines - tax is added on the invoice.
  const itemsNet = form.items.reduce((s2, i) => s2 + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const itemsTax = form.items.reduce((s2, i) => s2 + (i.quantity || 0) * (i.unitPrice || 0) * ((i.taxRate ?? 20) / 100), 0);
  // Cost of the services being sold. Engineer time is costed separately.
  const itemsCost = form.items.reduce((s2, i) => s2 + (i.quantity || 0) * (i.cost || 0), 0);

  const statuses = ['', 'draft', 'active', 'suspended', 'expired', 'cancelled'];

  const toggleExclusion = (rateId: string) => {
    setForm(f => ({
      ...f,
      excludedRateIds: f.excludedRateIds.includes(rateId)
        ? f.excludedRateIds.filter(id => id !== rateId)
        : [...f.excludedRateIds, rateId],
    }));
  };

  // The same modal creates and edits: one form, one set of fields to keep right.
  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      ...defaultForm,
      name: r.name || '',
      companyId: r.companyId || '',
      type: r.type || 'time_and_materials',
      status: r.status || 'draft',
      startDate: r.startDate ? String(r.startDate).slice(0, 10) : '',
      endDate: r.endDate ? String(r.endDate).slice(0, 10) : '',
      billingCycle: r.billingCycle || 'monthly',
      description: r.description || '',
      fixedPrice: r.fixedPrice != null ? String(r.fixedPrice) : '',
      billingMode: r.billingMode || 'one_off',
      instalmentCount: r.instalmentCount != null ? String(r.instalmentCount) : '',
      monthlyFee: r.monthlyFee != null ? String(r.monthlyFee) : '',
      totalHours: r.totalHours != null ? String(r.totalHours) : '',
      overhourRate: r.overhourRate != null ? String(r.overhourRate) : '',
      alertThreshold: r.alertThreshold != null ? String(r.alertThreshold) : '80',
      value: r.value != null ? String(r.value) : '',
      blockMode: r.blockMode || 'one_off',
      blockHourlyRate: r.blockHourlyRate != null ? String(r.blockHourlyRate) : '',
      hoursPerPeriod: r.hoursPerPeriod != null ? String(r.hoursPerPeriod) : '',
      carryOver: !!r.carryOver,
      carryOverMaxHours: r.carryOverMaxHours != null ? String(r.carryOverMaxHours) : '',
      autoTopUp: !!r.autoTopUp,
      topUpThresholdHours: r.topUpThresholdHours != null ? String(r.topUpThresholdHours) : '',
      topUpHours: r.topUpHours != null ? String(r.topUpHours) : '',
    } as any);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const payload: any = { ...form };
    delete payload.excludedRateIds;
    payload.excludedRateIds = form.excludedRateIds;
    // Include milestone details for fixed_price instalment contracts
    if (form.type === 'fixed_price' && form.billingMode === 'instalment' && form.milestones.length > 0) {
      payload.milestoneDetails = form.milestones.map((ms, idx) => ({
        number: idx + 1,
        description: ms.description || `Milestone ${idx + 1}`,
        amount: parseFloat(ms.amount) || 0,
        dueDate: ms.dueDate,
      }));
    }
    const res = editId
      ? await apiPatch(`/api/contracts/${editId}`, payload)
      : await apiPost('/api/contracts', payload);
    if (res) {
      setShowCreate(false);
      setForm(defaultForm);
      setEditId(null);
      refetch();
      if (!editId) router.push(`/contracts/${res.id}`);
    }
  };

  // Arriving from a contract's own page with ?edit=<id> opens the form on it.
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (!editParam || !data?.items) return;
    const row = data.items.find((c: any) => c.id === editParam);
    if (row) openEdit(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, data]);

  const typeLabel = (t: string) => CONTRACT_TYPES.find(ct => ct.value === t)?.label || t;
  const typeColor = (t: string) => CONTRACT_TYPES.find(ct => ct.value === t)?.color || 'text-slate-400';

  const valueDisplay = (r: any) => {
    switch (r.type) {
      case 'fixed_price': return formatCurrency(r.fixedPrice || r.value);
      case 'prepay_hours': return `${r.totalHours || 0}h block`;
      case 'managed_service': return 'Covered';
      default: return 'T&M';
    }
  };

  const hoursDisplay = (r: any) => {
    if (r.type !== 'prepay_hours') return null;
    const pct = r.totalHours ? ((r.hoursUsed || 0) / r.totalHours * 100) : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className={`text-xs ${pct > 90 ? 'text-red-400' : 'text-surface-400'}`}>
          {(r.hoursUsed || 0).toFixed(1)}/{r.totalHours}h
        </span>
      </div>
    );
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Contracts" subtitle="Manage service contracts and billing agreements">
        <button onClick={() => { setEditId(null); setForm(defaultForm); setShowCreate(true); }} className="btn-primary">+ New Contract</button>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="Search contracts..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input w-full max-w-md" />
          <div className="flex gap-2">
            {statuses.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${statusFilter === s ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? <LoadingSpinner /> : !data?.items?.length ? (
          <EmptyState title="No contracts found" description="Create your first contract" actionLabel="New Contract" onAction={() => setShowCreate(true)} />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'contractNumber', label: 'Number', render: (r: any) => (
                  <Link href={`/contracts/${r.id}`} className="text-blue-400 hover:text-blue-300 font-mono text-xs">{r.contractNumber}</Link>
                )},
                { key: 'name', label: 'Name', render: (r: any) => <span className="text-white font-medium">{r.name}</span> },
                { key: 'company', label: 'Company', render: (r: any) => <span className="text-surface-300">{r.company?.name || ' - '}</span> },
                { key: 'type', label: 'Type', render: (r: any) => <span className={`text-xs font-medium ${typeColor(r.type)}`}>{typeLabel(r.type)}</span> },
                { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
                { key: 'value', label: 'Value', render: (r: any) => <span className="text-white font-medium">{valueDisplay(r)}</span> },
                { key: 'hours', label: 'Hours', render: (r: any) => hoursDisplay(r) || <span className="text-surface-500"> - </span> },
                { key: 'exclusions', label: 'Exclusions', render: (r: any) => r.exclusions?.length > 0 ? (
                  <span className="text-xs text-amber-400">{r.exclusions.length} rate{r.exclusions.length > 1 ? 's' : ''} excluded</span>
                ) : <span className="text-surface-500"> - </span> },
                { key: 'endDate', label: 'Expires', render: (r: any) => (
                  <span className={r.endDate && new Date(r.endDate) < new Date() ? 'text-red-400 text-sm' : 'text-surface-400 text-sm'}>
                    {r.endDate ? formatDate(r.endDate) : 'No end date'}
                  </span>
                )},
                { key: 'actions', label: '', render: (r: any) => (
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openEdit(r); }}
                    className="text-xs px-2 py-1 rounded border border-surface-600 text-surface-300 hover:border-surface-500"
                  >
                    Edit
                  </button>
                )},
              ]}
              data={data.items}
              onRowClick={(r: any) => router.push(`/contracts/${r.id}`)}
            />
            <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Create Contract Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setEditId(null); }}
        title={editId ? 'Edit Contract' : 'New Contract'} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {/* Type selector */}
          <div>
            <label className="label">Contract Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {CONTRACT_TYPES.map(t => (
                <button key={t.value} type="button"
                  onClick={() => setForm({...form, type: t.value})}
                  className={`p-3 rounded-lg border text-left transition-all ${form.type === t.value
                    ? 'border-blue-500/50 bg-blue-500/10 text-white'
                    : 'border-surface-700 bg-surface-800/50 text-surface-400 hover:border-surface-600'}`}>
                  <div className={`font-medium text-sm ${form.type === t.value ? 'text-white' : ''}`}>{t.label}</div>
                  <div className="text-xs text-surface-500 mt-0.5">
                    {t.value === 'time_and_materials' && 'Bill per ticket at hourly rates'}
                    {t.value === 'fixed_price' && 'One-off or instalment billing'}
                    {t.value === 'prepay_hours' && 'Pre-purchased block of hours'}
                    {t.value === 'managed_service' && 'All labour covered, bill via recurring invoice'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Contract Name *</label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="e.g. Acme Corp Monthly Support" />
            </div>
            <div>
              <label className="label">Company *</label>
              <select className="input w-full" value={form.companyId} onChange={(e) => setForm({...form, companyId: e.target.value})}>
                <option value="">Select company</option>
                {companiesData?.items?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
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

          {/* Fixed Price fields */}
          {form.type === 'fixed_price' && (
            <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-4">
              <div className="text-sm font-medium text-blue-400">Fixed Price Settings</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Total Price (£) *</label>
                  <input className="input w-full" type="number" step="0.01" value={form.fixedPrice} onChange={(e) => setForm({...form, fixedPrice: e.target.value})} />
                </div>
                <div>
                  <label className="label">Billing Mode</label>
                  <select className="input w-full" value={form.billingMode} onChange={(e) => setForm({...form, billingMode: e.target.value})}>
                    <option value="one_off">One-off (single invoice)</option>
                    <option value="instalment">Instalments</option>
                  </select>
                </div>
              </div>
              {form.billingMode === 'instalment' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Number of Milestones</label>
                      <input className="input w-full" type="number" min="2" value={form.instalmentCount}
                        onChange={(e) => {
                          const count = parseInt(e.target.value) || 1;
                          const total = parseFloat(form.fixedPrice) || 0;
                          const milestones = count >= 2 ? generateDefaultMilestones(count, total, form.startDate, form.billingCycle) : [];
                          setForm({...form, instalmentCount: e.target.value, milestones});
                        }} />
                    </div>
                    <div>
                      <label className="label">Per Milestone (default)</label>
                      <div className="input w-full bg-surface-800 text-surface-300">
                        {form.fixedPrice && form.instalmentCount
                          ? formatCurrency(parseFloat(form.fixedPrice) / parseInt(form.instalmentCount))
                          : ' - '}
                      </div>
                    </div>
                  </div>

                  {/* Milestone detail rows */}
                  {form.milestones.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-surface-400 font-medium">Milestone Schedule</div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {form.milestones.map((ms, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-1 text-xs text-surface-500 text-center font-mono">{idx + 1}</div>
                            <div className="col-span-5">
                              <input className="input w-full text-sm" value={ms.description}
                                onChange={(e) => updateMilestone(idx, 'description', e.target.value)}
                                placeholder={`Milestone ${idx + 1}`} />
                            </div>
                            <div className="col-span-3">
                              <input className="input w-full text-sm" type="number" step="0.01" value={ms.amount}
                                onChange={(e) => updateMilestone(idx, 'amount', e.target.value)}
                                placeholder="Amount" />
                            </div>
                            <div className="col-span-3">
                              <input className="input w-full text-sm" type="date" value={ms.dueDate}
                                onChange={(e) => updateMilestone(idx, 'dueDate', e.target.value)} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-surface-500">
                        Total: {formatCurrency(form.milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0))}
                        {form.fixedPrice && (
                          <span className={Math.abs(form.milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0) - parseFloat(form.fixedPrice)) > 0.01 ? 'text-amber-400 ml-2' : 'text-green-400 ml-2'}>
                            {Math.abs(form.milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0) - parseFloat(form.fixedPrice)) > 0.01
                              ? `(differs from contract value by ${formatCurrency(Math.abs(form.milestones.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0) - parseFloat(form.fixedPrice)))})`
                              : '(matches contract value)'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pre-Pay Hours fields */}
          {form.type === 'prepay_hours' && (
            <div className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/5 space-y-4">
              <div className="text-sm font-medium text-purple-400">Pre-Pay Hours Settings</div>

              <div>
                <label className="label">Block type</label>
                <div className="flex gap-2">
                  {[
                    { key: 'one_off', label: 'One off', hint: 'A single block, billed once' },
                    { key: 'monthly', label: 'Monthly', hint: 'A new block every month' },
                  ].map(opt => (
                    <button key={opt.key} type="button"
                      onClick={() => setForm({ ...form, blockMode: opt.key })}
                      className={`flex-1 text-left px-3 py-2 rounded-lg border transition-colors ${
                        form.blockMode === opt.key
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-surface-700 hover:border-surface-600'
                      }`}>
                      <span className="block text-sm text-white">{opt.label}</span>
                      <span className="block text-xs text-surface-400">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours x hourly rate = price. The price is worked out, never
                  typed, so the three can never disagree. */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <label className="label">
                    Hours <span className="text-surface-500 font-normal">(per block)</span> *
                  </label>
                  <input className="input w-full" type="number" step="0.5"
                    value={form.blockMode === 'monthly' ? form.hoursPerPeriod : form.totalHours}
                    onChange={(e) => setForm(form.blockMode === 'monthly'
                      ? { ...form, hoursPerPeriod: e.target.value }
                      : { ...form, totalHours: e.target.value })} />
                </div>

                <span className="pb-2 text-surface-500">x</span>

                <div className="w-40">
                  <label className="label">Hourly rate (£) *</label>
                  <input className="input w-full" type="number" step="0.01" value={form.blockHourlyRate}
                    onChange={(e) => setForm({ ...form, blockHourlyRate: e.target.value })} />
                </div>

                <span className="pb-2 text-surface-500">=</span>

                <div className="w-44">
                  <label className="label">
                    Price <span className="text-surface-500 font-normal">(per block)</span>
                  </label>
                  <div className="input w-full bg-surface-800/60 text-white flex items-center">
                    £{(
                      (parseFloat(form.blockMode === 'monthly' ? form.hoursPerPeriod : form.totalHours) || 0) *
                      (parseFloat(form.blockHourlyRate) || 0)
                    ).toFixed(2)}
                  </div>
                </div>
              </div>
              {form.blockMode === 'monthly' && (
                <p className="text-xs text-surface-500">A block of these hours is raised every month.</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Overage rate (£/hr)</label>
                  <input className="input w-full" type="number" step="0.01" value={form.overhourRate}
                    onChange={(e) => setForm({ ...form, overhourRate: e.target.value })}
                    placeholder="Leave blank to prevent overages" />
                </div>
                <div>
                  <label className="label">Alert at % used</label>
                  <input className="input w-full" type="number" min="1" max="100" value={form.alertThreshold}
                    onChange={(e) => setForm({ ...form, alertThreshold: e.target.value })} />
                </div>
              </div>

              {/* Carry over only means anything when a new block arrives each month. */}
              {form.blockMode === 'monthly' && (
                <div className="space-y-2 pt-2 border-t border-surface-700/50">
                  <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={form.carryOver}
                      onChange={(e) => setForm({ ...form, carryOver: e.target.checked })} />
                    <span>
                      <span className="block">Carry unused hours into the next month</span>
                      <span className="block text-xs text-surface-400">
                        Off, and anything unused at the end of the month is lost.
                      </span>
                    </span>
                  </label>
                  {form.carryOver && (
                    <div className="pl-6">
                      <label className="label">Most hours that may carry</label>
                      <input className="input w-40" type="number" step="0.5" value={form.carryOverMaxHours}
                        onChange={(e) => setForm({ ...form, carryOverMaxHours: e.target.value })}
                        placeholder="No limit" />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-surface-700/50">
                <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={form.autoTopUp}
                    onChange={(e) => setForm({ ...form, autoTopUp: e.target.checked })} />
                  <span>
                    <span className="block">Top the block up automatically</span>
                    <span className="block text-xs text-surface-400">
                      Raise another block, chargeable, once the balance runs low.
                    </span>
                  </span>
                </label>
                {form.autoTopUp && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div>
                      <label className="label">Top up when below (hours)</label>
                      <input className="input w-full" type="number" step="0.5" value={form.topUpThresholdHours}
                        onChange={(e) => setForm({ ...form, topUpThresholdHours: e.target.value })} placeholder="0" />
                    </div>
                    <div>
                      <label className="label">Hours to add</label>
                      <input className="input w-full" type="number" step="0.5" value={form.topUpHours}
                        onChange={(e) => setForm({ ...form, topUpHours: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Managed Service info */}
          {form.type === 'managed_service' && (
            <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5 space-y-2">
              <div className="text-sm font-medium text-green-400">Managed Service Contract</div>
              <p className="text-xs text-slate-400">All labour logged against this contract will be covered (no charge to the customer). To bill the customer, create a recurring invoice with the services/products included.</p>
            </div>
          )}

          {/* Products & Services - these price the contract and the recurring
              invoice. A pre-pay contract is priced by its blocks instead, so
              the section is not shown: a line here would override the block
              price. */}
          {form.type !== 'prepay_hours' && (
          <div className="p-4 rounded-lg border border-brand-500/20 bg-brand-500/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-brand-400">Products &amp; Services</div>
                <p className="text-xs text-slate-400 mt-0.5">
                  What this contract charges. The net total becomes the contract value.
                </p>
              </div>
              <button type="button" onClick={addItem} className="btn-secondary text-xs px-3 py-1.5">
                + Add line
              </button>
            </div>

            {form.items.length === 0 ? (
              <p className="text-xs text-slate-500">
                No lines yet - the contract will be created with a value of £0.00.
              </p>
            ) : (
              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input className="input col-span-4" placeholder="e.g. Managed endpoint"
                      value={it.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })} />
                    <input className="input col-span-2 text-right" type="number" step="any" placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })} />
                    <input className="input col-span-2 text-right" type="number" step="any" placeholder="Unit £"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} />
                    <input className="input col-span-2 text-right" type="number" step="any" min="0" placeholder="Cost £"
                      title="What this line costs us per unit"
                      value={it.cost}
                      onChange={(e) => updateItem(idx, { cost: parseFloat(e.target.value) || 0 })} />
                    <input className="input col-span-1 text-right" type="number" step="any" placeholder="Tax %"
                      value={it.taxRate}
                      onChange={(e) => updateItem(idx, { taxRate: parseFloat(e.target.value) || 0 })} />
                    <button type="button" onClick={() => removeItem(idx)}
                      className="col-span-1 text-slate-500 hover:text-red-400 text-sm">✕</button>
                  </div>
                ))}

                <div className="flex justify-end pt-2 border-t border-white/10">
                  <div className="w-56 text-sm space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Contract value (net)</span>
                      <span className="font-semibold text-white">{formatCurrency(itemsNet)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>Invoice total (inc. tax)</span>
                      <span>{formatCurrency(itemsNet + itemsTax)}</span>
                    </div>
                    {itemsCost > 0 && (
                      <div className="flex justify-between text-xs pt-1 border-t border-white/10">
                        <span className="text-slate-400">Margin before labour</span>
                        <span className={itemsNet - itemsCost >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {formatCurrency(itemsNet - itemsCost)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-slate-300 pt-1">
              <input type="checkbox" checked={form.createInvoice}
                onChange={(e) => setForm({ ...form, createInvoice: e.target.checked })} />
              Create the recurring invoice now (appears in Ready to Bill immediately)
            </label>
          </div>
          )}

          {/* Billing Rate Exclusions (for prepay and managed) */}
          {(form.type === 'prepay_hours' || form.type === 'managed_service') && ratesData?.items?.length > 0 && (
            <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-3">
              <div className="text-sm font-medium text-amber-400">Billing Rate Exclusions</div>
              <p className="text-xs text-surface-400">Excluded rates will be charged as T&M instead of deducting from the contract.</p>
              <div className="space-y-2">
                {ratesData.items.map((rate: any) => (
                  <label key={rate.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-800/50">
                    <input type="checkbox" checked={form.excludedRateIds.includes(rate.id)}
                      onChange={() => toggleExclusion(rate.id)}
                      className="rounded border-surface-600" />
                    <div>
                      <span className="text-sm text-white">{rate.name}</span>
                      <span className="text-xs text-surface-500 ml-2">{rate.code} - {formatCurrency(rate.rate)}/hr</span>
                    </div>
                    {form.excludedRateIds.includes(rate.id) && (
                      <span className="text-xs text-amber-400 ml-auto">→ Charged as T&M</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label">Notes</label>
            <textarea className="input w-full" rows={2} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
          </div>

          <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-surface-900 py-3">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate}
              disabled={!form.name || !form.companyId || (form.type === 'fixed_price' && !form.fixedPrice) || (form.type === 'prepay_hours' && !form.totalHours)}
              className="btn-primary">Create Contract</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
