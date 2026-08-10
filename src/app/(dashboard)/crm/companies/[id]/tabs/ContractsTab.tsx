'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/hooks/useApi';
import { Modal, StatusBadge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { FileText, Plus, Calendar } from 'lucide-react';

interface ContractsTabProps {
  company: any;
  onRefresh: () => void;
}

const emptyForm = {
  name: '',
  type: 'time_and_materials',
  status: 'draft',
  startDate: '',
  endDate: '',
  value: '',
  billingCycle: 'monthly',
  description: '',
};

const TYPE_LABELS: Record<string, string> = {
  time_and_materials: 'T&M',
  fixed_price: 'Fixed Price',
  prepay_hours: 'Prepay Hours',
  managed_service: 'Managed Service',
};

const TYPE_COLORS: Record<string, string> = {
  time_and_materials: 'bg-blue-500/20 text-blue-400',
  fixed_price: 'bg-purple-500/20 text-purple-400',
  prepay_hours: 'bg-amber-500/20 text-amber-400',
  managed_service: 'bg-emerald-500/20 text-emerald-400',
};

export default function ContractsTab({ company, onRefresh }: ContractsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const contracts = company.contracts || [];

  const openAdd = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const payload: any = {
      name: form.name,
      companyId: company.id,
      type: form.type,
      status: form.status,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      billingCycle: form.billingCycle,
      description: form.description || undefined,
    };

    // Map value to the correct type-specific field
    const val = parseFloat(form.value);
    if (!isNaN(val) && val > 0) {
      switch (form.type) {
        case 'fixed_price':
          payload.fixedPrice = val;
          break;
        case 'managed_service':
          payload.monthlyFee = val;
          break;
        case 'prepay_hours':
          payload.value = val;
          break;
        default:
          payload.value = val;
      }
    }

    const res = await apiPost('/api/contracts', payload);
    setSaving(false);
    if (res) {
      setShowModal(false);
      onRefresh();
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">Contracts ({contracts.length})</h3>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-3.5 h-3.5" /> Add Contract
        </button>
      </div>

      {contracts.length > 0 ? (
        <div className="space-y-3">
          {contracts.map((c: any) => (
            <Link key={c.id} href={`/contracts/${c.id}`}
              className="block bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-400">{c.contractNumber}</span>
                      <span className="text-white font-medium text-sm">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(c.startDate)} - {formatDate(c.endDate)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm text-white font-medium">{formatCurrency(c.value || 0)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[c.type] || 'bg-white/10 text-slate-400'}`}>
                    {TYPE_LABELS[c.type] || c.type}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No contracts yet</p>
      )}

      {/* Add Contract Modal */}
      {showModal && (
        <Modal title="Add Contract" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full" placeholder="e.g. Annual Support Contract" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full">
                  <option value="time_and_materials">Time & Materials</option>
                  <option value="fixed_price">Fixed Price</option>
                  <option value="prepay_hours">Prepay Hours</option>
                  <option value="managed_service">Managed Service</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Start Date</label>
                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">End Date</label>
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Value</label>
                <input type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="w-full" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Billing Cycle</label>
                <select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })} className="w-full">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full" placeholder="Contract details..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.name || saving}>
                {saving ? 'Creating...' : 'Add Contract'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
