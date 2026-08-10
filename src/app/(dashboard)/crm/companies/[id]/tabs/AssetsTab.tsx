'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApi, apiPost } from '@/hooks/useApi';
import { Modal, LoadingSpinner } from '@/components/ui';
import { Monitor, Plus } from 'lucide-react';

interface AssetsTabProps {
  company: any;
}

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

const emptyForm = {
  name: '',
  type: 'device',
  assetTag: '',
  serialNumber: '',
  manufacturer: '',
  model: '',
  status: 'active',
};

export default function AssetsTab({ company }: AssetsTabProps) {
  const { data, loading, refetch } = useApi<any>(`/api/assets?companyId=${company.id}&limit=100`);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const assets = data?.items || [];

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const payload: any = {
      ...form,
      companyId: company.id,
    };
    Object.keys(payload).forEach(k => {
      if (payload[k] === '') delete payload[k];
    });
    payload.name = form.name;
    payload.type = form.type;
    payload.status = form.status;
    payload.companyId = company.id;

    const res = await apiPost('/api/assets', payload);
    setSaving(false);
    if (res) {
      setShowModal(false);
      setForm(emptyForm);
      refetch();
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">Assets ({assets.length})</h3>
        <button onClick={() => { setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-3.5 h-3.5" /> Add Asset
        </button>
      </div>

      {assets.length > 0 ? (
        <div className="space-y-3">
          {assets.map((a: any) => (
            <Link key={a.id} href={`/assets/${a.id}`}
              className="block bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium text-sm">{a.name}</span>
                      {a.assetTag && <span className="font-mono text-xs text-slate-500">{a.assetTag}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {a.manufacturer && <span>{a.manufacturer}</span>}
                      {a.model && <span>{a.manufacturer ? `/ ${a.model}` : a.model}</span>}
                      {a.serialNumber && <span className="font-mono">SN: {a.serialNumber}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[a.type] || TYPE_COLORS.other}`}>
                    {a.type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] || STATUS_COLORS.inactive}`}>
                    {a.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No assets yet</p>
      )}

      {/* Add Asset Modal */}
      {showModal && (
        <Modal title="Add Asset" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full" placeholder="e.g. Dell Latitude 5520" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full">
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
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="retired">Retired</option>
                  <option value="in_repair">In Repair</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Asset Tag</label>
                <input value={form.assetTag} onChange={e => setForm({ ...form, assetTag: e.target.value })} className="w-full" placeholder="e.g. AST-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Serial Number</label>
                <input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Manufacturer</label>
                <input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Model</label>
                <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.name || saving}>
                {saving ? 'Creating...' : 'Add Asset'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
