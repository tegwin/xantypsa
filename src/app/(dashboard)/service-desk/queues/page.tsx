'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Button, Modal, LoadingSpinner } from '@/components/ui';
import { Plus, Trash2, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Member { id: string; name: string; email: string }
interface Queue {
  id: string; name: string; description: string | null;
  isDefault: boolean; isActive: boolean;
  _count: { tickets: number };
  members: Member[];
  isOpenToEveryone: boolean;
}

export default function QueuesPage() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [agents, setAgents] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queueTab, setQueueTab] = useState<'agents' | 'settings'>('agents');

  const load = async () => {
    const [q, u] = await Promise.all([
      fetch('/api/ticket-queues').then(r => r.json()),
      fetch('/api/users').then(r => r.json()).catch(() => ({ items: [] })),
    ]);
    setQueues(q.items ?? []);
    setAgents((u.items ?? []).map((x: any) => ({ id: x.id, name: x.name, email: x.email })));
    setLoading(false);
    // Open the first queue by default, so the tabs are never an empty frame.
    setSelectedId(prev => prev ?? (q.items?.[0]?.id ?? null));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) return toast.error('Give the queue a name');
    setSaving(true);
    try {
      const res = await fetch('/api/ticket-queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || 'Could not create it');
      toast.success('Queue created');
      setShowCreate(false);
      setForm({ name: '', description: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q: Queue) => {
    if (!confirm(`Delete "${q.name}"?`)) return;
    const res = await fetch(`/api/ticket-queues/${q.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    // The API refuses while tickets still sit in it, and says how many.
    if (!res.ok) return toast.error(json.error || 'Could not delete it');
    toast.success('Queue deleted');
    load();
  };

  const toggleActive = async (q: Queue) => {
    await fetch(`/api/ticket-queues/${q.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !q.isActive }),
    });
    load();
  };

  const setMember = async (queueId: string, userId: string, add: boolean) => {
    const res = add
      ? await fetch(`/api/ticket-queues/${queueId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
      : await fetch(`/api/ticket-queues/${queueId}/members?userId=${userId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return toast.error(json.error || 'Could not change that');
    }
    load();
  };

  const selected = queues.find(q => q.id === selectedId) ?? null;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title="Ticket Queues" description="Who works what, and who can see it.">
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>New queue</Button>
      </PageHeader>

      <div className="rounded-lg border border-surface-700 bg-surface-800/40 p-3 text-sm text-surface-300">
        A queue with nobody in it is visible to everyone. Add engineers and only they see its
        tickets, except administrators, who always see every queue. Anybody keeps sight of a
        ticket assigned to them, wherever it sits.
      </div>

      <div className="space-y-2">
        {queues.length === 0 ? (
          <p className="text-sm text-surface-400">No queues yet.</p>
        ) : queues.map(q => (
          <div
            key={q.id}
            onClick={() => setSelectedId(q.id)}
            className={`cursor-pointer rounded-lg border p-4 transition-colors ${
              q.id === selectedId
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-surface-700 bg-surface-800/40 hover:border-surface-600'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-surface-100">
                  {q.name}
                  {q.isDefault && <span className="ml-2 text-xs text-brand-400">Default</span>}
                  {!q.isActive && <span className="ml-2 text-xs text-surface-500">Inactive</span>}
                </p>
                <p className="mt-0.5 text-xs text-surface-500">
                  {q._count.tickets} {q._count.tickets === 1 ? 'ticket' : 'tickets'}
                  {' · '}
                  {q.isOpenToEveryone
                    ? 'open to everyone'
                    : `${q.members.length} ${q.members.length === 1 ? 'engineer' : 'engineers'}: ${q.members.map(m => m.name).join(', ')}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); toggleActive(q); }} className="btn-secondary text-xs">
                  {q.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); remove(q); }}
                  aria-label={`Delete ${q.name}`}
                  className="rounded-md p-2 text-surface-400 hover:bg-surface-700 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New queue"
        footer={<>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button loading={saving} onClick={create}>Create queue</Button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-400 mb-1">Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Second line" className="w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-400 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full" />
          </div>
        </div>
      </Modal>

      {selected && (
        <div className="rounded-lg border border-surface-700 bg-surface-800/40">
          <div className="flex items-center gap-1 border-b border-surface-700 px-3 pt-3">
            {([
              { key: 'agents' as const, label: 'Agents' },
              { key: 'settings' as const, label: 'Settings' },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => setQueueTab(t.key)}
                aria-current={queueTab === t.key ? 'page' : undefined}
                className={`rounded-t-md px-4 py-2 text-sm transition-colors ${
                  queueTab === t.key
                    ? 'bg-surface-800 text-white border-b-2 border-brand-500'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
            <span className="ml-auto pb-2 text-xs text-surface-500">{selected.name}</span>
          </div>

          <div className="p-4">
            {queueTab === 'agents' && (
              <div className="space-y-3">
                <p className="text-sm text-surface-400">
                  {selected.isOpenToEveryone
                    ? 'Nobody is in this queue, so every agent can see its tickets. Tick somebody to close it.'
                    : 'Only these agents, and administrators, can see tickets in this queue.'}
                </p>
                {agents.length === 0 ? (
                  <p className="text-sm text-surface-500">No agents to add yet.</p>
                ) : (
                  <div className="space-y-2">
                    {agents.map(a => {
                      const isMember = selected.members.some(m => m.id === a.id);
                      return (
                        <label key={a.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-700 bg-surface-900/40 p-3 hover:border-surface-600">
                          <input type="checkbox" checked={isMember}
                            onChange={e => setMember(selected.id, a.id, e.target.checked)} />
                          <span className="min-w-0">
                            <span className="block text-sm text-surface-100">{a.name}</span>
                            <span className="block text-xs text-surface-500">{a.email}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {queueTab === 'settings' && (
              <div className="space-y-2 text-sm text-surface-300">
                <p><span className="text-surface-500">Tickets:</span> {selected._count.tickets}</p>
                <p><span className="text-surface-500">Status:</span> {selected.isActive ? 'Active' : 'Inactive'}</p>
                <p><span className="text-surface-500">Default queue:</span> {selected.isDefault ? 'Yes' : 'No'}</p>
                {selected.description && (
                  <p><span className="text-surface-500">Description:</span> {selected.description}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
