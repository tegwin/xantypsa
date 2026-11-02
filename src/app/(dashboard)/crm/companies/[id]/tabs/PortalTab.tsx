'use client';

import { useState } from 'react';
import { apiPatch } from '@/hooks/useApi';
import toast from 'react-hot-toast';

/**
 * The client's own portal: whether it is on, its address, and how it looks.
 *
 * Branding is per client, so each one sees their own logo and colour rather
 * than ours.
 */
export default function PortalTab({ company, onRefresh }: { company: any; onRefresh: () => void }) {
  const [form, setForm] = useState({
    portalEnabled: !!company.portalEnabled,
    portalSlug: company.portalSlug || '',
    portalLogoUrl: company.portalLogoUrl || '',
    portalAccent: company.portalAccent || '#1e6af5',
    portalWelcome: company.portalWelcome || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (form.portalEnabled && !form.portalSlug.trim()) {
      toast.error('A portal needs an address before it can be switched on');
      return;
    }
    setSaving(true);
    try {
      await apiPatch(`/api/companies/${company.id}`, form);
      toast.success('Portal settings saved');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="glass rounded-xl p-6 max-w-2xl space-y-5">
      <div>
        <h3 className="text-white font-semibold">Client portal</h3>
        <p className="text-sm text-surface-400">
          Where this client signs in to raise tickets and follow their work.
        </p>
      </div>

      <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-700 cursor-pointer hover:border-surface-600">
        <input type="checkbox" className="mt-1" checked={form.portalEnabled}
          onChange={e => setForm({ ...form, portalEnabled: e.target.checked })} />
        <span>
          <span className="block text-sm text-surface-200">This client has a portal</span>
          <span className="block text-xs text-surface-400">
            Individual contacts also need access of their own, on their Portal tab.
          </span>
        </span>
      </label>

      <div>
        <label className="label" htmlFor="portal-slug">Portal address</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 shrink-0">{origin}/portal/</span>
          <input id="portal-slug" className="input flex-1" value={form.portalSlug}
            onChange={e => setForm({ ...form, portalSlug: e.target.value })}
            placeholder="acme" />
        </div>
        <p className="text-xs text-surface-400 mt-1">
          Lowercase letters, numbers and hyphens. It must be unique across every client.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="portal-logo">Logo URL</label>
          <input id="portal-logo" className="input w-full" value={form.portalLogoUrl}
            onChange={e => setForm({ ...form, portalLogoUrl: e.target.value })}
            placeholder="https://example.com/logo.png" />
          <p className="text-xs text-surface-400 mt-1">Their logo, shown in the portal header.</p>
        </div>
        <div>
          <label className="label" htmlFor="portal-accent">Accent colour</label>
          <input id="portal-accent" type="color" className="input w-full h-10" value={form.portalAccent}
            onChange={e => setForm({ ...form, portalAccent: e.target.value })} />
          <p className="text-xs text-surface-400 mt-1">Used on tiles, buttons and progress bars.</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="portal-welcome">Welcome heading</label>
        <input id="portal-welcome" className="input w-full" value={form.portalWelcome}
          onChange={e => setForm({ ...form, portalWelcome: e.target.value })}
          placeholder="Welcome, how can we help you today?" />
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-surface-700/50">
        {form.portalEnabled && form.portalSlug && (
          <a href={`/portal/${form.portalSlug}`} target="_blank" rel="noreferrer"
            className="text-sm text-brand-400 hover:text-brand-300">
            Open the portal
          </a>
        )}
        <button onClick={save} disabled={saving} className="btn-primary text-sm ml-auto disabled:opacity-50">
          {saving ? 'Saving...' : 'Save portal settings'}
        </button>
      </div>
    </div>
  );
}
