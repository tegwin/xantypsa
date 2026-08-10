'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/useApi';
import { Modal, StatusBadge } from '@/components/ui';
import { MapPin, Edit, Trash2, Plus, Star } from 'lucide-react';

interface SitesTabProps {
  company: any;
  onRefresh: () => void;
}

const emptyForm = {
  name: '',
  address1: '',
  address2: '',
  address3: '',
  city: '',
  state: '',
  postcode: '',
  country: '',
  phone: '',
  email: '',
};

export default function SitesTab({ company, onRefresh }: SitesTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showDeleteId, setShowDeleteId] = useState<string | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (site: any) => {
    setEditingId(site.id);
    setForm({
      name: site.name || '',
      address1: site.address1 || '',
      address2: site.address2 || '',
      address3: site.address3 || '',
      city: site.city || '',
      state: site.state || '',
      postcode: site.postcode || '',
      country: site.country || '',
      phone: site.phone || '',
      email: site.email || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (editingId) {
      await apiPatch(`/api/sites/${editingId}`, form);
    } else {
      await apiPost('/api/sites', { ...form, companyId: company.id });
    }
    setShowModal(false);
    onRefresh();
  };

  const handleDelete = async () => {
    if (showDeleteId) {
      await apiDelete(`/api/sites/${showDeleteId}`);
      setShowDeleteId(null);
      onRefresh();
    }
  };

  const sites = company.sites || [];

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">Sites ({sites.length})</h3>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-3.5 h-3.5" /> Add Site
        </button>
      </div>

      {sites.length > 0 ? (
        <div className="space-y-3">
          {sites.map((site: any) => (
            <div key={site.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-white font-medium text-sm">{site.name}</span>
                  {site.isDefault && (
                    <span className="flex items-center gap-1 text-xs text-amber-400"><Star className="w-3 h-3" /> Default</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(site)} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  {!site.isDefault && (
                    <button onClick={() => setShowDeleteId(site.id)} className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="ml-6 text-sm text-slate-300 space-y-0.5">
                {site.address1 && <div>{site.address1}</div>}
                {site.address2 && <div>{site.address2}</div>}
                {site.address3 && <div>{site.address3}</div>}
                <div>{[site.city, site.state, site.postcode].filter(Boolean).join(', ')}</div>
                {site.country && <div>{site.country}</div>}
                {(site.phone || site.email) && (
                  <div className="flex gap-4 mt-1 text-xs text-slate-400">
                    {site.phone && <span>{site.phone}</span>}
                    {site.email && <span>{site.email}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No sites added yet</p>
      )}

      {/* Add/Edit Site Modal */}
      {showModal && (
        <Modal title={editingId ? 'Edit Site' : 'Add Site'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Site Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full" placeholder="e.g. Head Office" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Address 1</label>
              <input value={form.address1} onChange={e => setForm({ ...form, address1: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Address 2</label>
              <input value={form.address2} onChange={e => setForm({ ...form, address2: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Address 3</label>
              <input value={form.address3} onChange={e => setForm({ ...form, address3: e.target.value })} className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">City</label>
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">State / County</label>
                <input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Postcode / Zip</label>
                <input value={form.postcode} onChange={e => setForm({ ...form, postcode: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Country</label>
                <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.name}>
                {editingId ? 'Save Changes' : 'Add Site'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {showDeleteId && (
        <Modal title="Delete Site" onClose={() => setShowDeleteId(null)}>
          <p className="text-slate-300 mb-6">Are you sure you want to delete this site? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDeleteId(null)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Site</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
