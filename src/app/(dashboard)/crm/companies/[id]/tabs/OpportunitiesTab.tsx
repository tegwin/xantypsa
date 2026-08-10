'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge, Modal } from '@/components/ui';
import { apiPost } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TrendingUp, Plus } from 'lucide-react';

interface OpportunitiesTabProps {
  company: any;
  onRefresh?: () => void;
}

const emptyForm = {
  title: '',
  value: '',
  stage: 'lead',
  probability: '10',
  source: '',
  expectedClose: '',
  notes: '',
};

export default function OpportunitiesTab({ company, onRefresh }: OpportunitiesTabProps) {
  const opportunities = company.opportunities || [];
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const payload: any = {
      title: form.title,
      stage: form.stage,
      companyId: company.id,
    };
    if (form.value) payload.value = parseFloat(form.value);
    if (form.probability) payload.probability = parseInt(form.probability);
    if (form.source) payload.source = form.source;
    if (form.expectedClose) payload.expectedClose = new Date(form.expectedClose).toISOString();
    if (form.notes) payload.notes = form.notes;

    const res = await apiPost('/api/opportunities', payload);
    setSaving(false);
    if (res) {
      setShowModal(false);
      setForm(emptyForm);
      onRefresh?.();
    }
  };

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">Opportunities ({opportunities.length})</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-3.5 h-3.5" /> Add Opportunity
          </button>
          <Link href={`/crm/opportunities?companyId=${company.id}`} className="text-sm text-brand-400 hover:text-brand-300">View all →</Link>
        </div>
      </div>
      {opportunities.length > 0 ? (
        <div className="space-y-2">
          {opportunities.map((opp: any) => (
            <Link key={opp.id} href={`/crm/opportunities/${opp.id}`}
              className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-white text-sm font-medium">{opp.title}</span>
                  {opp.expectedClose && (
                    <span className="ml-2 text-xs text-slate-500">Close: {formatDate(opp.expectedClose)}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">{formatCurrency(opp.value)}</span>
                <span className="text-xs text-slate-400">{opp.probability}%</span>
                <StatusBadge status={opp.stage} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No opportunities yet</p>
      )}

      {/* Add Opportunity Modal */}
      {showModal && (
        <Modal title="Add Opportunity" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full" placeholder="e.g. Annual support contract" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Value</label>
                <input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="w-full" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Probability %</label>
                <input type="number" min="0" max="100" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Stage</label>
                <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className="w-full">
                  <option value="lead">Lead</option>
                  <option value="qualified">Qualified</option>
                  <option value="proposal">Proposal</option>
                  <option value="negotiation">Negotiation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Source</label>
                <input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full" placeholder="e.g. Referral" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Expected Close</label>
              <input type="date" value={form.expectedClose} onChange={e => setForm({ ...form, expectedClose: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full" placeholder="Additional details..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.title || saving}>
                {saving ? 'Creating...' : 'Add Opportunity'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
