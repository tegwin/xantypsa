'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge, Modal } from '@/components/ui';
import { apiPost } from '@/hooks/useApi';
import { formatRelativeTime } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface TicketsTabProps {
  company: any;
  onRefresh?: () => void;
}

const emptyForm = {
  title: '',
  description: '',
  priority: 'medium',
  type: 'service_request',
  contactId: '',
};

export default function TicketsTab({ company, onRefresh }: TicketsTabProps) {
  const tickets = company.tickets || [];
  const contacts = company.contacts || [];
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title) return;
    setSaving(true);
    const payload: any = {
      title: form.title,
      priority: form.priority,
      type: form.type,
      companyId: company.id,
    };
    if (form.description) payload.description = form.description;
    if (form.contactId) payload.contactId = form.contactId;

    const res = await apiPost('/api/tickets', payload);
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
        <h3 className="text-white font-semibold">Tickets ({tickets.length})</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-3.5 h-3.5" /> New Ticket
          </button>
          <Link href={`/service-desk/tickets?companyId=${company.id}`} className="text-sm text-brand-400 hover:text-brand-300">View all →</Link>
        </div>
      </div>
      {tickets.length > 0 ? (
        <div className="space-y-2">
          {tickets.map((t: any) => (
            <Link key={t.id} href={`/service-desk/tickets/${t.id}`}
              className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">{t.ticketNumber}</span>
                <span className="text-white text-sm">{t.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={t.status} />
                <span className="text-xs text-slate-500">{formatRelativeTime(t.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No tickets yet</p>
      )}

      {/* New Ticket Modal */}
      {showModal && (
        <Modal title="New Ticket" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full" placeholder="e.g. Email not working" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full" placeholder="Describe the issue..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full">
                  <option value="incident">Incident</option>
                  <option value="service_request">Service Request</option>
                  <option value="problem">Problem</option>
                </select>
              </div>
            </div>
            {contacts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Contact</label>
                <select value={form.contactId} onChange={e => setForm({ ...form, contactId: e.target.value })} className="w-full">
                  <option value="">-- Select contact --</option>
                  {contacts.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.title || saving}>
                {saving ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
