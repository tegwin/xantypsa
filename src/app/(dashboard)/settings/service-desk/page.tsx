'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader, Button, Modal, Input, Badge } from '@/components/ui';
import { Plus, Pencil, Trash2, GripVertical, Layers, ToggleLeft, ToggleRight, Star, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface TicketStatus { id: string; name: string; slug: string; color: string; isClosed: boolean; isDefault: boolean; isSystem: boolean; sortOrder: number; isActive: boolean; }
interface TicketQueue { id: string; name: string; description: string; isDefault: boolean; isActive: boolean; sortOrder: number; _count?: { tickets: number } }

const STATUS_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#94a3b8','#f97316','#14b8a6'];

export default function ServiceDeskSettingsPage() {
  const [billingMode, setBillingMode] = useState('anytime');
  const [statuses, setStatuses] = useState<TicketStatus[]>([]);
  const [queues, setQueues] = useState<TicketQueue[]>([]);
  const [loading, setLoading] = useState(true);

  // Status modal
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editStatusId, setEditStatusId] = useState<string | null>(null);
  const [statusForm, setStatusForm] = useState({ name: '', color: '#3b82f6', isClosed: false, isDefault: false });

  // Queue modal
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [editQueueId, setEditQueueId] = useState<string | null>(null);
  const [queueForm, setQueueForm] = useState({ name: '', description: '', isDefault: false });

  const [saving, setSaving] = useState(false);
  const [timer, setTimer] = useState({
    timerEnabled: true,
    timerOnlyOnTimeEntry: false,
    timerOnlyOnPublicNotes: false,
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/service-desk').then(r => r.json()),
      fetch('/api/ticket-statuses').then(r => r.json()),
      fetch('/api/ticket-queues').then(r => r.json()),
    ]).then(([sdSettings, statusData, queueData]) => {
      setBillingMode(sdSettings.billingMode || 'anytime');
      setTimer({
        timerEnabled: sdSettings.timerEnabled ?? true,
        timerOnlyOnTimeEntry: sdSettings.timerOnlyOnTimeEntry ?? false,
        timerOnlyOnPublicNotes: sdSettings.timerOnlyOnPublicNotes ?? false,
      });
      setStatuses(statusData.items || []);
      setQueues(queueData.items || []);
      setLoading(false);
    });
  }, []);

  // === Billing Mode ===
  const saveBillingMode = async (mode: string) => {
    setBillingMode(mode);
    await fetch('/api/settings/service-desk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingMode: mode }),
    });
    toast.success(`Billing mode set to: ${mode === 'anytime' ? 'Bill anytime' : 'Bill on close'}`);
  };

  // === Timer ===
  const saveTimer = async (patch: Partial<typeof timer>) => {
    const next = { ...timer, ...patch };
    setTimer(next);
    await fetch('/api/settings/service-desk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    toast.success('Timer settings saved');
  };

  // === Statuses ===
  const openNewStatus = () => {
    setEditStatusId(null);
    setStatusForm({ name: '', color: '#3b82f6', isClosed: false, isDefault: false });
    setShowStatusModal(true);
  };

  const openEditStatus = (s: TicketStatus) => {
    setEditStatusId(s.id);
    setStatusForm({ name: s.name, color: s.color, isClosed: s.isClosed, isDefault: s.isDefault });
    setShowStatusModal(true);
  };

  const saveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editStatusId ? `/api/ticket-statuses/${editStatusId}` : '/api/ticket-statuses';
      const method = editStatusId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(statusForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(editStatusId ? 'Status updated' : 'Status created');
      setShowStatusModal(false);
      const r = await fetch('/api/ticket-statuses').then(r => r.json());
      setStatuses(r.items || []);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const deleteStatus = async (s: TicketStatus) => {
    if (!confirm(`Delete status "${s.name}"?`)) return;
    try {
      const res = await fetch(`/api/ticket-statuses/${s.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Status deleted');
      setStatuses(statuses.filter(x => x.id !== s.id));
    } catch (err: any) { toast.error(err.message); }
  };

  // === Queues ===
  const openNewQueue = () => {
    setEditQueueId(null);
    setQueueForm({ name: '', description: '', isDefault: false });
    setShowQueueModal(true);
  };

  const openEditQueue = (q: TicketQueue) => {
    setEditQueueId(q.id);
    setQueueForm({ name: q.name, description: q.description || '', isDefault: q.isDefault });
    setShowQueueModal(true);
  };

  const saveQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editQueueId ? `/api/ticket-queues/${editQueueId}` : '/api/ticket-queues';
      const method = editQueueId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(queueForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(editQueueId ? 'Queue updated' : 'Queue created');
      setShowQueueModal(false);
      const r = await fetch('/api/ticket-queues').then(r => r.json());
      setQueues(r.items || []);
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const deleteQueue = async (q: TicketQueue) => {
    if (!confirm(`Delete queue "${q.name}"?`)) return;
    try {
      const res = await fetch(`/api/ticket-queues/${q.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Queue deleted');
      setQueues(queues.filter(x => x.id !== q.id));
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="p-8 text-surface-400">Loading...</div>;

  return (
    <div className="space-y-8 animate-fadeIn">
      <PageHeader title="Service Desk" subtitle="Configure ticket statuses, queues, and billing behaviour" />

      {/* === BILLING MODE === */}
      <div className="glass-panel p-6">
        <h3 className="text-white font-semibold mb-1">Time Entry Billing</h3>
        <p className="text-sm text-surface-400 mb-4">Choose when time entries become available for invoicing.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => saveBillingMode('anytime')}
            className={`p-4 rounded-lg border text-left transition-all ${
              billingMode === 'anytime' ? 'border-brand-500 bg-brand-500/10' : 'border-surface-700 hover:border-surface-600'
            }`}>
            <div className="flex items-center gap-2 mb-1">
              {billingMode === 'anytime' ? <ToggleRight className="h-5 w-5 text-brand-400" /> : <ToggleLeft className="h-5 w-5 text-surface-500" />}
              <span className={`font-medium ${billingMode === 'anytime' ? 'text-brand-400' : 'text-surface-300'}`}>Bill anytime</span>
            </div>
            <p className="text-xs text-surface-400">Time entries are available for invoicing as soon as they're logged, regardless of ticket status.</p>
          </button>

          <button onClick={() => saveBillingMode('on_close')}
            className={`p-4 rounded-lg border text-left transition-all ${
              billingMode === 'on_close' ? 'border-brand-500 bg-brand-500/10' : 'border-surface-700 hover:border-surface-600'
            }`}>
            <div className="flex items-center gap-2 mb-1">
              {billingMode === 'on_close' ? <ToggleRight className="h-5 w-5 text-brand-400" /> : <ToggleLeft className="h-5 w-5 text-surface-500" />}
              <span className={`font-medium ${billingMode === 'on_close' ? 'text-brand-400' : 'text-surface-300'}`}>Bill on close only</span>
            </div>
            <p className="text-xs text-surface-400">Time entries only become available for invoicing once the ticket is closed.</p>
          </button>
        </div>
      </div>

      {/* === TIMER === */}
      <div className="glass-panel p-6">
        <div className="mb-4">
          <h2 className="text-white font-semibold">Timer</h2>
          <p className="text-sm text-surface-400">
            A work timer on each ticket, shown in the action bar and in the time entry panel.
            It keeps running when you leave the ticket and across a page reload.
          </p>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-700 cursor-pointer hover:border-surface-600">
          <input type="checkbox" className="mt-1" checked={timer.timerEnabled}
            onChange={e => saveTimer({ timerEnabled: e.target.checked })} />
          <span>
            <span className="block text-sm text-surface-200">Show the timer on tickets</span>
            <span className="block text-xs text-surface-400">Turn this off to hide the timer everywhere.</span>
          </span>
        </label>

        <div className={`mt-3 space-y-3 ${timer.timerEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
          <p className="text-xs text-surface-500">
            With both of these off the timer runs the whole time a ticket is open. Each one
            below narrows when it runs.
          </p>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-700 cursor-pointer hover:border-surface-600">
            <input type="checkbox" className="mt-1" checked={timer.timerOnlyOnTimeEntry}
              onChange={e => saveTimer({ timerOnlyOnTimeEntry: e.target.checked })} />
            <span>
              <span className="block text-sm text-surface-200">Only run while the time entry panel is open</span>
              <span className="block text-xs text-surface-400">The timer stays paused on the ticket until you open Add Time.</span>
            </span>
          </label>

          <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-700 cursor-pointer hover:border-surface-600">
            <input type="checkbox" className="mt-1" checked={timer.timerOnlyOnPublicNotes}
              onChange={e => saveTimer({ timerOnlyOnPublicNotes: e.target.checked })} />
            <span>
              <span className="block text-sm text-surface-200">Only run while writing a public note</span>
              <span className="block text-xs text-surface-400">Switching to a private note pauses the timer, so internal work is not timed.</span>
            </span>
          </label>
        </div>
      </div>

      {/* === TICKET STATUSES === */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">Ticket Statuses</h3>
            <p className="text-sm text-surface-400">Define the workflow statuses for your tickets. Statuses marked as "closed" won't appear in default ticket views.</p>
          </div>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openNewStatus}>Add Status</Button>
        </div>

        {statuses.length === 0 ? (
          <div className="text-center py-6">
            <AlertCircle className="h-8 w-8 text-surface-600 mx-auto mb-2" />
            <p className="text-sm text-surface-400">No custom statuses configured. Default statuses (new, open, pending, resolved, closed) will be used.</p>
            <Button size="sm" className="mt-3" onClick={openNewStatus}>Create Statuses</Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {statuses.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-surface-800/50 rounded-lg px-4 py-2.5 group">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="font-medium text-surface-100 flex-1">{s.name}</span>
                <span className="text-xs font-mono text-surface-500">{s.slug}</span>
                {s.isDefault && <span className="text-xs bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded">Default</span>}
                {s.isClosed && <span className="text-xs bg-surface-600/50 text-surface-400 px-1.5 py-0.5 rounded">Closed</span>}
                {s.isSystem && <span className="text-xs bg-surface-700 text-surface-500 px-1.5 py-0.5 rounded">System</span>}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditStatus(s)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200"><Pencil className="h-3.5 w-3.5" /></button>
                  {!s.isSystem && <button onClick={() => deleteStatus(s)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === QUEUES === */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-semibold">Ticket Queues</h3>
            <p className="text-sm text-surface-400">Organise tickets into queues for team routing (e.g. First Line, Second Line, Projects).</p>
          </div>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={openNewQueue}>Add Queue</Button>
        </div>

        {queues.length === 0 ? (
          <div className="text-center py-6">
            <Layers className="h-8 w-8 text-surface-600 mx-auto mb-2" />
            <p className="text-sm text-surface-400">No queues configured.</p>
            <Button size="sm" className="mt-3" onClick={openNewQueue}>Create Queue</Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {queues.map(q => (
              <div key={q.id} className="flex items-center gap-3 bg-surface-800/50 rounded-lg px-4 py-2.5 group">
                <Layers className="h-4 w-4 text-surface-500" />
                <div className="flex-1">
                  <span className="font-medium text-surface-100">{q.name}</span>
                  {q.description && <p className="text-xs text-surface-500">{q.description}</p>}
                </div>
                <span className="text-xs text-surface-500">{q._count?.tickets || 0} tickets</span>
                {q.isDefault && <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditQueue(q)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteQueue(q)} className="p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === STATUS MODAL === */}
      <Modal open={showStatusModal} onClose={() => setShowStatusModal(false)} title={editStatusId ? 'Edit Status' : 'New Status'}
        footer={<><Button variant="secondary" onClick={() => setShowStatusModal(false)}>Cancel</Button><Button loading={saving} onClick={saveStatus}>{editStatusId ? 'Save' : 'Create'}</Button></>}>
        <form onSubmit={saveStatus} className="space-y-4">
          <Input label="Status Name" value={statusForm.name} onChange={e => setStatusForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. In Progress, Waiting on Client" />
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {STATUS_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setStatusForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full transition-all ${statusForm.color === c ? 'ring-2 ring-offset-2 ring-offset-surface-800 ring-brand-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
            <input type="checkbox" checked={statusForm.isClosed} onChange={e => setStatusForm(p => ({ ...p, isClosed: e.target.checked }))} />
            Treat as closed (hidden from default ticket views)
          </label>
          <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
            <input type="checkbox" checked={statusForm.isDefault} onChange={e => setStatusForm(p => ({ ...p, isDefault: e.target.checked }))} />
            Default status for new tickets
          </label>
        </form>
      </Modal>

      {/* === QUEUE MODAL === */}
      <Modal open={showQueueModal} onClose={() => setShowQueueModal(false)} title={editQueueId ? 'Edit Queue' : 'New Queue'}
        footer={<><Button variant="secondary" onClick={() => setShowQueueModal(false)}>Cancel</Button><Button loading={saving} onClick={saveQueue}>{editQueueId ? 'Save' : 'Create'}</Button></>}>
        <form onSubmit={saveQueue} className="space-y-4">
          <Input label="Queue Name" value={queueForm.name} onChange={e => setQueueForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. First Line, Second Line, Projects" />
          <Input label="Description" value={queueForm.description} onChange={e => setQueueForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
          <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
            <input type="checkbox" checked={queueForm.isDefault} onChange={e => setQueueForm(p => ({ ...p, isDefault: e.target.checked }))} />
            Default queue for new tickets
          </label>
        </form>
      </Modal>
    </div>
  );
}
