'use client';

import { useState } from 'react';
import { useApi, apiPost } from '@/hooks/useApi';
import { PageHeader, Modal } from '@/components/ui';
import toast from 'react-hot-toast';

const VARIABLES = ['{quote_number}', '{quote_title}', '{customer_name}', '{company_name}', '{company_email}', '{total}', '{currency_symbol}', '{issue_date}', '{expiry_date}', '{quote_link}', '{notes}'];

export default function EmailTemplatesPage() {
  const { data, loading, refetch } = useApi<any>('/api/settings/email-templates');
  const [editing, setEditing] = useState<any>(null);

  const save = async () => {
    if (!editing) return;
    await apiPost('/api/settings/email-templates', { slug: editing.slug, name: editing.name, subject: editing.subject, body: editing.body });
    toast.success('Template saved');
    setEditing(null);
    refetch();
  };

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Email Templates" subtitle="Customize email templates for quotes" />
      <div className="space-y-3 max-w-3xl">
        {(data?.items || []).map((t: any) => (
          <div key={t.slug} className="glass rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{t.name}</p>
              <p className="text-sm text-slate-400">{t.subject}</p>
            </div>
            <button onClick={() => setEditing({ ...t })} className="btn-secondary text-sm">Edit</button>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)} size="lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Subject</label>
              <input value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Body (HTML)</label>
              <textarea rows={12} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} className="w-full font-mono text-xs" />
            </div>
            <div className="p-3 bg-white/5 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">Available variables:</p>
              <div className="flex flex-wrap gap-1">
                {VARIABLES.map(v => (
                  <button key={v} onClick={() => setEditing({ ...editing, body: editing.body + v })}
                    className="text-xs px-2 py-1 rounded bg-brand-600/20 text-brand-400 hover:bg-brand-600/30">{v}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save Template</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
