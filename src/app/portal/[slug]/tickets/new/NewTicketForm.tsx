'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewTicketForm({
  slug,
  meId,
  colleagues = [],
}: {
  slug: string;
  meId?: string;
  /** Empty unless this person may raise on somebody else's behalf. */
  colleagues?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    onBehalfOfContactId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (res.status === 401) {
        throw new Error('Your session has expired. Reload this page and try again.');
      }
      if (!res.ok) throw new Error(body.error || 'Could not raise the ticket.');
      router.push(`/portal/${slug}/tickets/${body.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm text-slate-300">
          What is the problem?
        </label>
        <input
          id="title"
          required
          maxLength={200}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Cannot log in to Outlook"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm
                     text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm text-slate-300">
          Any detail that would help
        </label>
        <textarea
          id="description"
          rows={6}
          required
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="What were you doing? Any error message? Who else is affected?"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm
                     text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
        />
      </div>


      {/* Only shown to somebody allowed to raise for a colleague, which needs
          sight of the whole company's tickets so they can follow it afterwards. */}
      {colleagues.length > 0 && (
        <div>
          <label htmlFor="onBehalfOf" className="mb-1.5 block text-sm text-slate-300">
            Who is this for?
          </label>
          <select
            id="onBehalfOf"
            value={form.onBehalfOfContactId || meId || ''}
            onChange={(e) => setForm({ ...form, onBehalfOfContactId: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
          >
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id === meId ? `${c.name} (me)` : c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {colleagues.length > 1
              ? 'The ticket is raised against this person, so updates go to them.'
              : 'You are the only contact at your company at the moment.'}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={saving || !form.title.trim() || !form.description.trim()}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white
                   transition-colors hover:bg-brand-500 disabled:opacity-50"
      >
        {saving ? 'Raising…' : 'Raise ticket'}
      </button>
    </form>
  );
}
