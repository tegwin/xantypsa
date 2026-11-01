'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader, Button, Modal, Input, DataTable, Badge, EmptyState } from '@/components/ui';
import { Plus, Pencil, Trash2, DollarSign, Clock, Star } from 'lucide-react';
import toast from 'react-hot-toast';

interface BillingRate {
  id: string;
  name: string;
  code: string;
  rate: number;
  costRate: number;
  minimumMinutes: number;
  roundingMinutes: number;
  oohMultiplier: number;
  isDefault: boolean;
  isActive: boolean;
}

const emptyForm = {
  name: '', code: '', rate: '', costRate: '0', minimumMinutes: '15',
  roundingMinutes: '15', oohMultiplier: '1.0', isDefault: false,
};

export default function BillingSettingsPage() {
  const [rates, setRates] = useState<BillingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchRates = async () => {
    const res = await fetch('/api/billing-rates');
    const data = await res.json();
    setRates(data.items || []);
    setLoading(false);
  };

  useEffect(() => { fetchRates(); }, []);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (rate: BillingRate) => {
    setEditId(rate.id);
    setForm({
      name: rate.name,
      code: rate.code || '',
      rate: rate.rate.toString(),
      costRate: rate.costRate.toString(),
      minimumMinutes: rate.minimumMinutes.toString(),
      roundingMinutes: rate.roundingMinutes.toString(),
      oohMultiplier: rate.oohMultiplier.toString(),
      isDefault: rate.isDefault,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editId ? `/api/billing-rates/${editId}` : '/api/billing-rates';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(editId ? 'Rate updated' : 'Rate created');
      setShowModal(false);
      fetchRates();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rate: BillingRate) => {
    if (!confirm(`Delete "${rate.name}" billing rate?`)) return;
    try {
      const res = await fetch(`/api/billing-rates/${rate.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Rate deleted');
      fetchRates();
    } catch {
      toast.error('Failed to delete rate');
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const columns = [
    { key: 'name', header: 'Rate Name', render: (r: BillingRate) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-surface-100">{r.name}</span>
        {r.isDefault && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
        {!r.isActive && <Badge variant="status" status="closed">Inactive</Badge>}
      </div>
    )},
    { key: 'code', header: 'Code', render: (r: BillingRate) => (
      <span className="font-mono text-xs text-surface-400">{r.code || ' - '}</span>
    )},
    { key: 'rate', header: 'Rate/hr', render: (r: BillingRate) => (
      <span className="font-medium text-surface-100">£{r.rate.toFixed(2)}</span>
    )},
    { key: 'costRate', header: 'Cost/hr', render: (r: BillingRate) => (
      <span className="text-surface-400">£{r.costRate.toFixed(2)}</span>
    )},
    { key: 'minimum', header: 'Minimum', render: (r: BillingRate) => (
      <span className="text-surface-300">{r.minimumMinutes} mins</span>
    )},
    { key: 'rounding', header: 'Increment', render: (r: BillingRate) => (
      <span className="text-surface-300">{r.roundingMinutes} mins</span>
    )},
    { key: 'ooh', header: 'OOH Multiplier', render: (r: BillingRate) => (
      <span className={r.oohMultiplier > 1 ? 'text-amber-400 font-medium' : 'text-surface-400'}>
        {r.oohMultiplier}x {r.oohMultiplier > 1 && `(£${(r.rate * r.oohMultiplier).toFixed(2)}/hr)`}
      </span>
    )},
    { key: 'actions', header: '', render: (r: BillingRate) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
          className="p-1.5 rounded-md hover:bg-surface-700 text-surface-400 hover:text-surface-200" title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
          className="p-1.5 rounded-md hover:bg-surface-700 text-surface-400 hover:text-red-400" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Billing" subtitle="Manage billing rates, minimums, increments and out-of-hours multipliers"
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={openNew}>New Billing Rate</Button>} />

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="h-5 w-5 text-brand-400" />
            <h4 className="text-sm font-medium text-surface-200">Rate/hr</h4>
          </div>
          <p className="text-xs text-surface-400">The hourly charge rate applied to time entries. Each rate can have a different price.</p>
        </div>
        <div className="glass-panel p-4">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-brand-400" />
            <h4 className="text-sm font-medium text-surface-200">Min / Increment</h4>
          </div>
          <p className="text-xs text-surface-400">Minimum billable time and rounding increment. E.g. 15 min minimum, rounded to 15 min blocks.</p>
        </div>
        <div className="glass-panel p-4">
          <div className="flex items-center gap-3 mb-2">
            <Star className="h-5 w-5 text-amber-400" />
            <h4 className="text-sm font-medium text-surface-200">OOH Multiplier</h4>
          </div>
          <p className="text-xs text-surface-400">Out-of-hours multiplier applied to the rate. E.g. 1.5x turns £100/hr into £150/hr OOH.</p>
        </div>
      </div>

      {rates.length > 0 ? (
        <DataTable columns={columns} data={rates} loading={loading} emptyMessage="No billing rates" />
      ) : !loading ? (
        <EmptyState
          icon={<DollarSign className="w-12 h-12" />}
          title="No billing rates configured"
          description="Create your first billing rate to start tracking billable time against tickets and projects."
          action={<Button onClick={openNew}>Create Billing Rate</Button>}
        />
      ) : null}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Billing Rate' : 'New Billing Rate'}
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>{editId ? 'Save Changes' : 'Create Rate'}</Button></>}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Rate Name" value={form.name} onChange={update('name')} required placeholder="e.g. Standard, Premium" />
            <Input label="Code" value={form.code} onChange={update('code')} placeholder="e.g. STD, PREM" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Rate (£/hr)" type="number" step="0.01" value={form.rate} onChange={update('rate')} required placeholder="100.00" />
            <Input label="Cost Rate (£/hr)" type="number" step="0.01" value={form.costRate} onChange={update('costRate')} placeholder="50.00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Minimum Minutes" type="number" value={form.minimumMinutes} onChange={update('minimumMinutes')} placeholder="15" />
            <Input label="Rounding Increment (mins)" type="number" value={form.roundingMinutes} onChange={update('roundingMinutes')} placeholder="15" />
          </div>
          <Input label="OOH Multiplier" type="number" step="0.1" value={form.oohMultiplier} onChange={update('oohMultiplier')} placeholder="1.5" />
          {form.oohMultiplier && parseFloat(form.oohMultiplier) > 1 && form.rate && (
            <p className="text-xs text-amber-400">OOH rate: £{(parseFloat(form.rate || '0') * parseFloat(form.oohMultiplier)).toFixed(2)}/hr</p>
          )}
          <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
            <input type="checkbox" checked={form.isDefault as any} onChange={(e) => setForm(p => ({ ...p, isDefault: e.target.checked as any }))} />
            Set as default billing rate
          </label>
        </form>
      </Modal>
    </div>
  );
}
