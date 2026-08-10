'use client';

import { useState } from 'react';
import { useApi, apiPost, apiDelete } from '@/hooks/useApi';
import { PageHeader, Modal } from '@/components/ui';
import { Trash2, Edit, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function QuoteTemplatesPage() {
  const { data, loading, refetch } = useApi<any>('/api/quote-templates');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', notes: '', terms: '' });

  const create = async () => {
    if (!form.name) return;
    await apiPost('/api/quote-templates', { ...form, items: [] });
    toast.success('Template created');
    setShowCreate(false);
    setForm({ name: '', description: '', notes: '', terms: '' });
    refetch();
  };

  const remove = async (id: string) => {
    await apiDelete(`/api/quote-templates/${id}`);
    toast.success('Template deleted');
    refetch();
  };

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Quote Templates" subtitle="Manage reusable quote templates">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> New Template</button>
      </PageHeader>

      <div className="space-y-3 max-w-3xl">
        {(data?.items || []).length > 0 ? (data.items.map((t: any) => (
          <div key={t.id} className="glass rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{t.name}</p>
              {t.description && <p className="text-sm text-slate-400">{t.description}</p>}
              <p className="text-xs text-slate-500 mt-1">{Array.isArray(t.items) ? t.items.length : 0} items</p>
            </div>
            <button onClick={() => remove(t.id)} className="p-2 rounded hover:bg-white/10 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))) : (
          <div className="glass rounded-xl p-8 text-center text-sm text-slate-500">No templates yet. Create one or save from an existing quote.</div>
        )}
      </div>

      {showCreate && (
        <Modal title="New Quote Template" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-slate-400 mb-1">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-400 mb-1">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-400 mb-1">Default Notes</label><textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full" /></div>
            <div><label className="block text-sm font-medium text-slate-400 mb-1">Default Terms</label><textarea rows={2} value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} className="w-full" /></div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button onClick={create} disabled={!form.name} className="btn-primary">Create Template</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
