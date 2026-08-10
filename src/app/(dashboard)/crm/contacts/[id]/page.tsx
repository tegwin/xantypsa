'use client';

import { useState } from 'react';
import { useApi, apiPatch, apiDelete } from '@/hooks/useApi';
import { PageHeader, StatusBadge, LoadingSpinner, Modal } from '@/components/ui';
import { formatRelativeTime } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { User, Building2, Mail, Phone, Smartphone, MapPin, Briefcase, Edit, Trash2 } from 'lucide-react';

export default function ContactDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: contact, loading, refetch } = useApi<any>(`/api/contacts/${id}`);
  const { data: companiesData } = useApi<any>('/api/companies?limit=100');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [showDelete, setShowDelete] = useState(false);

  if (loading) return <LoadingSpinner />;
  if (!contact) return <div className="p-8 text-slate-400">Contact not found</div>;

  const startEdit = () => {
    setEditForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      jobTitle: contact.jobTitle || '',
      department: contact.department || '',
      companyId: contact.companyId || '',
      notes: contact.notes || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await apiPatch(`/api/contacts/${id}`, editForm);
    setEditing(false);
    refetch();
  };

  const handleDelete = async () => {
    await apiDelete(`/api/contacts/${id}`);
    router.push('/crm/contacts');
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title={`${contact.firstName} ${contact.lastName}`} subtitle={contact.jobTitle || contact.company?.name || ''}>
        <div className="flex gap-2">
          <button onClick={startEdit} className="btn-secondary flex items-center gap-1.5">
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => setShowDelete(true)} className="btn-danger flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={() => router.push('/crm/contacts')} className="btn-secondary">← Back</button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Tickets */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Recent Tickets ({contact._count?.tickets || 0})</h3>
            {contact.tickets?.length > 0 ? (
              <div className="space-y-2">
                {contact.tickets.map((t: any) => (
                  <Link key={t.id} href={`/service-desk/tickets/${t.id}`}
                    className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-400">{t.ticketNumber}</span>
                      <span className="text-white text-sm">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.priority} />
                      <StatusBadge status={t.status} />
                      <span className="text-xs text-slate-500">{formatRelativeTime(t.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No tickets for this contact</p>
            )}
          </div>

          {/* Notes */}
          {contact.notes && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">Notes</h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-lg">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div>
                <h3 className="text-white font-semibold">{contact.firstName} {contact.lastName}</h3>
                {contact.jobTitle && <p className="text-sm text-slate-400">{contact.jobTitle}</p>}
              </div>
            </div>

            <div className="space-y-3 text-sm pt-2 border-t border-white/10">
              {contact.company && (
                <Link href={`/crm/companies/${contact.company.id}`}
                  className="flex items-center gap-2 text-brand-400 hover:text-brand-300">
                  <Building2 className="w-4 h-4" /> {contact.company.name}
                </Link>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <Mail className="w-4 h-4 text-slate-400" /> {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <Phone className="w-4 h-4 text-slate-400" /> {contact.phone}
                </a>
              )}
              {contact.mobile && (
                <a href={`tel:${contact.mobile}`} className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <Smartphone className="w-4 h-4 text-slate-400" /> {contact.mobile}
                </a>
              )}
              {contact.department && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Briefcase className="w-4 h-4 text-slate-400" /> {contact.department}
                </div>
              )}
              {contact.source && (
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-4 h-4 text-slate-400" /> Source: {contact.source}
                </div>
              )}
            </div>
          </div>

          {(contact.address || contact.city) && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">Address</h3>
              <div className="flex items-start gap-2 text-sm text-slate-300">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  {contact.address && <div>{contact.address}</div>}
                  <div>{[contact.city, contact.state, contact.postcode].filter(Boolean).join(', ')}</div>
                  {contact.country && <div>{contact.country}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <Modal title="Edit Contact" onClose={() => setEditing(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">First Name *</label>
                <input value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Last Name *</label>
                <input value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Company</label>
              <select value={editForm.companyId} onChange={e => setEditForm({ ...editForm, companyId: e.target.value })} className="w-full">
                <option value="">No company</option>
                {companiesData?.items?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Job Title</label>
                <input value={editForm.jobTitle} onChange={e => setEditForm({ ...editForm, jobTitle: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Department</label>
                <input value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Mobile</label>
                <input value={editForm.mobile} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
              <textarea rows={3} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="w-full" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveEdit} className="btn-primary">Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <Modal title="Delete Contact" onClose={() => setShowDelete(false)}>
          <p className="text-slate-300 mb-6">
            Are you sure you want to delete <strong className="text-white">{contact.firstName} {contact.lastName}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Contact</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
