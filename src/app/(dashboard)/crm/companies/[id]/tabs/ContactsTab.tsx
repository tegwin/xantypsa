'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui';
import { apiPost } from '@/hooks/useApi';
import { Mail, Phone, Plus } from 'lucide-react';

interface ContactsTabProps {
  company: any;
  onRefresh?: () => void;
}

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  mobile: '',
  jobTitle: '',
  department: '',
};

export default function ContactsTab({ company, onRefresh }: ContactsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.firstName || !form.lastName) return;
    setSaving(true);
    const payload: any = {
      firstName: form.firstName,
      lastName: form.lastName,
      companyId: company.id,
    };
    if (form.email) payload.email = form.email;
    if (form.phone) payload.phone = form.phone;
    if (form.mobile) payload.mobile = form.mobile;
    if (form.jobTitle) payload.jobTitle = form.jobTitle;
    if (form.department) payload.department = form.department;

    const res = await apiPost('/api/contacts', payload);
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
        <h3 className="text-white font-semibold">Contacts</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-3.5 h-3.5" /> Add Contact
          </button>
          <Link href={`/crm/contacts?companyId=${company.id}`} className="text-sm text-brand-400 hover:text-brand-300">View all →</Link>
        </div>
      </div>
      {company.contacts?.length > 0 ? (
        <div className="space-y-2">
          {company.contacts.map((c: any) => (
            <Link key={c.id} href={`/crm/contacts/${c.id}`}
              className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
              <div>
                <span className="text-white text-sm font-medium">{c.firstName} {c.lastName}</span>
                {c.jobTitle && <span className="ml-2 text-xs text-slate-400">{c.jobTitle}</span>}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>}
                {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No contacts yet</p>
      )}

      {/* Add Contact Modal */}
      {showModal && (
        <Modal title="Add Contact" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">First Name *</label>
                <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="w-full" placeholder="John" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Last Name *</label>
                <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="w-full" placeholder="Smith" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full" placeholder="john@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full" placeholder="+44 123 456 7890" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Mobile</label>
                <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} className="w-full" placeholder="+44 7700 900000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Job Title</label>
                <input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} className="w-full" placeholder="e.g. IT Manager" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Department</label>
                <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full" placeholder="e.g. IT" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.firstName || !form.lastName || saving}>
                {saving ? 'Creating...' : 'Add Contact'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
