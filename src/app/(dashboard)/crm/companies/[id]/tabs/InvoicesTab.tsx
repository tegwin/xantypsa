'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge, Modal } from '@/components/ui';
import { apiPost } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface InvoicesTabProps {
  company: any;
  onRefresh?: () => void;
}

const emptyForm = {
  title: '',
  paymentTerms: '30',
};

export default function InvoicesTab({ company, onRefresh }: InvoicesTabProps) {
  const invoices = company.invoices || [];
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const payload: any = {
      title: form.title,
      companyId: company.id,
      paymentTerms: parseInt(form.paymentTerms),
    };

    const res = await apiPost('/api/invoices', payload);
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
        <h3 className="text-white font-semibold">Invoices ({invoices.length})</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-3.5 h-3.5" /> New Invoice
          </button>
          <Link href={`/invoices/list?companyId=${company.id}`} className="text-sm text-brand-400 hover:text-brand-300">View all →</Link>
        </div>
      </div>
      {invoices.length > 0 ? (
        <div className="space-y-2">
          {invoices.map((inv: any) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}
              className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">{inv.invoiceNumber}</span>
                <span className="text-white text-sm">{inv.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">{formatCurrency(inv.total)}</span>
                {inv.amountDue > 0 && (
                  <span className="text-xs text-amber-400">Due: {formatCurrency(inv.amountDue)}</span>
                )}
                <StatusBadge status={inv.status} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No invoices yet</p>
      )}

      {/* New Invoice Modal */}
      {showModal && (
        <Modal title="New Invoice" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full" placeholder="e.g. March 2026 Services" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Payment Terms (days)</label>
              <select value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })} className="w-full">
                <option value="0">Due on receipt</option>
                <option value="7">Net 7</option>
                <option value="14">Net 14</option>
                <option value="30">Net 30</option>
                <option value="45">Net 45</option>
                <option value="60">Net 60</option>
                <option value="90">Net 90</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.title || saving}>
                {saving ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
