'use client';

import { useState, useEffect } from 'react';
import { useApi, apiPatch, apiDelete } from '@/hooks/useApi';
import { PageHeader, LoadingSpinner, Modal, Badge } from '@/components/ui';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Monitor, Edit, Trash2, Building2, Calendar, Hash, Cpu, Shield, Save,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  inactive: 'bg-slate-500/20 text-slate-400',
  retired: 'bg-red-500/20 text-red-400',
  in_repair: 'bg-amber-500/20 text-amber-400',
  lost: 'bg-red-500/20 text-red-300',
};

const TYPE_COLORS: Record<string, string> = {
  device: 'bg-blue-500/20 text-blue-400',
  server: 'bg-purple-500/20 text-purple-400',
  network: 'bg-cyan-500/20 text-cyan-400',
  software: 'bg-emerald-500/20 text-emerald-400',
  peripheral: 'bg-amber-500/20 text-amber-400',
  other: 'bg-slate-500/20 text-slate-400',
};

export default function AssetDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: asset, loading, refetch } = useApi<any>(`/api/assets/${id}`);
  const { data: companiesData } = useApi<any>('/api/companies?limit=500');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const companies = companiesData?.items || [];

  if (loading) return <LoadingSpinner />;
  if (!asset) return <div className="p-8 text-slate-400">Asset not found</div>;

  const startEdit = () => {
    setEditForm({
      name: asset.name || '',
      type: asset.type || 'device',
      companyId: asset.companyId || '',
      assetTag: asset.assetTag || '',
      serialNumber: asset.serialNumber || '',
      manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      status: asset.status || 'active',
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
      warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : '',
      notes: asset.notes || '',
      rmmSource: asset.rmmSource || '',
      rmmExternalId: asset.rmmExternalId || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    const payload: any = { ...editForm };
    if (!payload.companyId) payload.companyId = null;
    if (!payload.purchaseDate) payload.purchaseDate = null;
    if (!payload.warrantyExpiry) payload.warrantyExpiry = null;
    await apiPatch(`/api/assets/${id}`, payload);
    setSaving(false);
    setEditing(false);
    refetch();
  };

  const handleDelete = async () => {
    await apiDelete(`/api/assets/${id}`);
    router.push('/assets/list');
  };

  const formatDate = (d: string | null) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const warrantyStatus = () => {
    if (!asset.warrantyExpiry) return null;
    const expiry = new Date(asset.warrantyExpiry);
    const now = new Date();
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Expired', color: 'bg-red-500/20 text-red-400' };
    if (daysLeft < 30) return { label: `${daysLeft}d left`, color: 'bg-amber-500/20 text-amber-400' };
    if (daysLeft < 90) return { label: `${daysLeft}d left`, color: 'bg-yellow-500/20 text-yellow-400' };
    return { label: `${daysLeft}d left`, color: 'bg-emerald-500/20 text-emerald-400' };
  };

  const warranty = warrantyStatus();

  return (
    <div className="animate-fadeIn">
      <PageHeader title={asset.name} subtitle={`${asset.type} asset`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[asset.status] || STATUS_COLORS.inactive}`}>
            {asset.status.replace('_', ' ')}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[asset.type] || TYPE_COLORS.other}`}>
            {asset.type}
          </span>
          {asset.rmmSource && (
            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-indigo-500/20 text-indigo-400">
              RMM: {asset.rmmSource}
            </span>
          )}
          <button onClick={startEdit} className="btn-secondary flex items-center gap-1.5">
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => setShowDelete(true)} className="btn-danger flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={() => router.push('/assets/list')} className="btn-secondary">&larr; Back</button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Asset Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Asset Tag</span>
                <p className="text-white font-mono">{asset.assetTag || '\u2014'}</p>
              </div>
              <div>
                <span className="text-slate-500">Serial Number</span>
                <p className="text-white font-mono">{asset.serialNumber || '\u2014'}</p>
              </div>
              <div>
                <span className="text-slate-500">Manufacturer</span>
                <p className="text-white">{asset.manufacturer || '\u2014'}</p>
              </div>
              <div>
                <span className="text-slate-500">Model</span>
                <p className="text-white">{asset.model || '\u2014'}</p>
              </div>
              <div>
                <span className="text-slate-500">Purchase Date</span>
                <p className="text-white">{formatDate(asset.purchaseDate)}</p>
              </div>
              <div>
                <span className="text-slate-500">Warranty Expiry</span>
                <div className="flex items-center gap-2">
                  <p className="text-white">{formatDate(asset.warrantyExpiry)}</p>
                  {warranty && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${warranty.color}`}>{warranty.label}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {asset.notes && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">Notes</h3>
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{asset.notes}</p>
            </div>
          )}

          {/* RMM Info */}
          {asset.rmmSource && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">RMM Integration</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">RMM Source</span>
                  <p className="text-white capitalize">{asset.rmmSource}</p>
                </div>
                <div>
                  <span className="text-slate-500">External ID</span>
                  <p className="text-white font-mono">{asset.rmmExternalId || '\u2014'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Custom Fields */}
          <CustomFieldsSection asset={asset} onRefresh={refetch} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Company */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">Company</h3>
            {asset.company ? (
              <Link href={`/crm/companies/${asset.company.id}`} className="flex items-center gap-2 text-brand-400 hover:text-brand-300 transition-colors">
                <Building2 className="w-4 h-4" />
                <span>{asset.company.name}</span>
              </Link>
            ) : (
              <p className="text-slate-500 text-sm">No company assigned</p>
            )}
          </div>

          {/* Metadata */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">Metadata</h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500">Created</span>
                <p className="text-slate-300">{formatDate(asset.createdAt)}</p>
              </div>
              <div>
                <span className="text-slate-500">Last Updated</span>
                <p className="text-slate-300">{formatDate(asset.updatedAt)}</p>
              </div>
              <div>
                <span className="text-slate-500">ID</span>
                <p className="text-slate-400 font-mono text-xs break-all">{asset.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <Modal title="Edit Asset" onClose={() => setEditing(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name *</label>
              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="w-full">
                  <option value="device">Device</option>
                  <option value="server">Server</option>
                  <option value="network">Network</option>
                  <option value="software">Software</option>
                  <option value="peripheral">Peripheral</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="retired">Retired</option>
                  <option value="in_repair">In Repair</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Company</label>
              <select value={editForm.companyId} onChange={e => setEditForm({ ...editForm, companyId: e.target.value })} className="w-full">
                <option value="">None</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Asset Tag</label>
                <input value={editForm.assetTag} onChange={e => setEditForm({ ...editForm, assetTag: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Serial Number</label>
                <input value={editForm.serialNumber} onChange={e => setEditForm({ ...editForm, serialNumber: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Manufacturer</label>
                <input value={editForm.manufacturer} onChange={e => setEditForm({ ...editForm, manufacturer: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Model</label>
                <input value={editForm.model} onChange={e => setEditForm({ ...editForm, model: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Purchase Date</label>
                <input type="date" value={editForm.purchaseDate} onChange={e => setEditForm({ ...editForm, purchaseDate: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Warranty Expiry</label>
                <input type="date" value={editForm.warrantyExpiry} onChange={e => setEditForm({ ...editForm, warrantyExpiry: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">RMM Source</label>
                <input value={editForm.rmmSource} onChange={e => setEditForm({ ...editForm, rmmSource: e.target.value })} className="w-full" placeholder="e.g. ninja, datto" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">RMM External ID</label>
                <input value={editForm.rmmExternalId} onChange={e => setEditForm({ ...editForm, rmmExternalId: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
              <textarea rows={3} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="w-full" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveEdit} className="btn-primary" disabled={!editForm.name || saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <Modal title="Delete Asset" onClose={() => setShowDelete(false)}>
          <p className="text-slate-300 mb-6">
            Are you sure you want to delete <strong className="text-white">{asset.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Asset</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CustomFieldsSection({ asset, onRefresh }: { asset: any; onRefresh: () => void }) {
  const { data: fieldsData, loading } = useApi<any>('/api/custom-fields?entityType=asset');
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const fields = fieldsData?.items || [];

  useEffect(() => {
    if (asset.customData) {
      try {
        const parsed = typeof asset.customData === 'string' ? JSON.parse(asset.customData) : asset.customData;
        setValues(parsed);
      } catch {
        setValues({});
      }
    }
  }, [asset.customData]);

  const handleSave = async () => {
    setSaving(true);
    await apiPatch(`/api/assets/${asset.id}`, { customData: values });
    setSaving(false);
    onRefresh();
  };

  const updateValue = (fieldKey: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  const renderField = (field: any) => {
    const value = values[field.fieldKey] ?? '';
    switch (field.fieldType) {
      case 'text': case 'url': case 'email': case 'phone':
        return <input type={field.fieldType === 'email' ? 'email' : field.fieldType === 'url' ? 'url' : 'text'} value={value} onChange={e => updateValue(field.fieldKey, e.target.value)} className="w-full" />;
      case 'number':
        return <input type="number" value={value} onChange={e => updateValue(field.fieldKey, e.target.value ? Number(e.target.value) : '')} className="w-full" />;
      case 'date':
        return <input type="date" value={value} onChange={e => updateValue(field.fieldKey, e.target.value)} className="w-full" />;
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!value} onChange={e => updateValue(field.fieldKey, e.target.checked)} className="rounded" />
            <span className="text-sm text-slate-300">{field.name}</span>
          </label>
        );
      case 'select': case 'dropdown':
        const options = Array.isArray(field.options) ? field.options : [];
        return (
          <select value={value} onChange={e => updateValue(field.fieldKey, e.target.value)} className="w-full">
            <option value="">Select...</option>
            {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      default:
        return <input type="text" value={value} onChange={e => updateValue(field.fieldKey, e.target.value)} className="w-full" />;
    }
  };

  if (loading) return null;
  if (!fields.length) return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-semibold">Custom Fields</h3>
        <Link href="/settings/custom-fields" className="text-xs text-brand-400 hover:text-brand-300">Manage fields &rarr;</Link>
      </div>
      <p className="text-sm text-slate-500 text-center py-4">No custom fields defined for assets</p>
    </div>
  );

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">Custom Fields</h3>
        <div className="flex items-center gap-2">
          <Link href="/settings/custom-fields" className="text-xs text-brand-400 hover:text-brand-300">Manage fields &rarr;</Link>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5 text-sm">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field: any) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {field.name} {field.required && <span className="text-red-400">*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}
      </div>
    </div>
  );
}
