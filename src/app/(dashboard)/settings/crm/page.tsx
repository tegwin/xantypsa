'use client';

import { useEffect, useState } from 'react';
import { PageHeader, LoadingSpinner, Modal, Input, Select, Button } from '@/components/ui';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

interface Stage {
  id: string; name: string; slug: string; color: string; probability: number;
  isWon: boolean; isLost: boolean; isDefault: boolean; sortOrder: number; isActive: boolean;
}
interface Reason { id: string; name: string; type: string; sortOrder: number; isActive: boolean }

const emptyStage = { name: '', color: '#3b82f6', probability: '0', outcome: 'open', isDefault: false, sortOrder: '99' };

export default function CrmSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<Stage[]>([]);
  const [reasons, setReasons] = useState<Reason[]>([]);

  const [showStage, setShowStage] = useState(false);
  const [editStageId, setEditStageId] = useState<string | null>(null);
  const [stageForm, setStageForm] = useState<any>(emptyStage);
  const [saving, setSaving] = useState(false);

  const [reasonName, setReasonName] = useState('');
  const [reasonType, setReasonType] = useState<'win' | 'loss'>('loss');

  const load = async () => {
    const [s, r] = await Promise.all([
      fetch('/api/pipeline-stages').then(x => x.json()),
      fetch('/api/win-loss-reasons').then(x => x.json()),
    ]);
    setStages(s.items || []);
    setReasons(r.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNewStage = () => { setEditStageId(null); setStageForm(emptyStage); setShowStage(true); };
  const openEditStage = (s: Stage) => {
    setEditStageId(s.id);
    setStageForm({
      name: s.name, color: s.color, probability: String(s.probability),
      outcome: s.isWon ? 'won' : s.isLost ? 'lost' : 'open',
      isDefault: s.isDefault, sortOrder: String(s.sortOrder),
    });
    setShowStage(true);
  };

  const saveStage = async () => {
    if (!stageForm.name.trim()) { toast.error('A stage needs a name'); return; }
    setSaving(true);
    try {
      const payload = {
        name: stageForm.name,
        color: stageForm.color,
        probability: stageForm.probability,
        isWon: stageForm.outcome === 'won',
        isLost: stageForm.outcome === 'lost',
        isDefault: stageForm.isDefault,
        sortOrder: stageForm.sortOrder,
      };
      const res = await fetch(editStageId ? `/api/pipeline-stages/${editStageId}` : '/api/pipeline-stages', {
        method: editStageId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the stage');
      toast.success(editStageId ? 'Stage saved' : 'Stage created');
      setShowStage(false);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteStage = async (s: Stage) => {
    if (!confirm(`Delete the "${s.name}" stage?`)) return;
    const res = await fetch(`/api/pipeline-stages/${s.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Could not delete the stage'); return; }
    toast.success(data.message || 'Stage deleted');
    load();
  };

  const addReason = async () => {
    if (!reasonName.trim()) { toast.error('Enter a reason'); return; }
    const res = await fetch('/api/win-loss-reasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: reasonName, type: reasonType }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Could not add the reason'); return; }
    setReasonName('');
    toast.success('Reason added');
    load();
  };

  const deleteReason = async (r: Reason) => {
    if (!confirm(`Delete "${r.name}"?`)) return;
    const res = await fetch(`/api/win-loss-reasons/${r.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Could not delete the reason'); return; }
    toast.success(data.message || 'Reason deleted');
    load();
  };

  if (loading) return <LoadingSpinner />;

  const outcomeLabel = (s: Stage) => (s.isWon ? 'Won' : s.isLost ? 'Lost' : 'Open');

  return (
    <div className="animate-fadeIn">
      <PageHeader title="CRM" subtitle="Sales pipeline stages and win or loss reasons" />

      {/* Pipeline stages */}
      <div className="glass-panel p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white font-semibold">Sales pipeline</h2>
            <p className="text-sm text-surface-400">
              The stages a deal moves through. Order here is the order shown on the pipeline board
              and in the funnel report.
            </p>
          </div>
          <button onClick={openNewStage} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" /> New stage
          </button>
        </div>

        <table className="w-full text-sm">
          <caption className="sr-only">Pipeline stages</caption>
          <thead>
            <tr className="text-left text-xs text-surface-400 border-b border-surface-700">
              <th scope="col" className="py-2">Stage</th>
              <th scope="col" className="py-2">Outcome</th>
              <th scope="col" className="py-2 text-right">Probability</th>
              <th scope="col" className="py-2 text-right">Order</th>
              <th scope="col" className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stages.map(s => (
              <tr key={s.id} className="border-b border-surface-800">
                <td className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-white">{s.name}</span>
                    {s.isDefault && <span className="text-xs text-brand-400">default</span>}
                    {!s.isActive && <span className="text-xs text-surface-500">inactive</span>}
                  </span>
                </td>
                <td className="py-2 text-surface-300">{outcomeLabel(s)}</td>
                <td className="py-2 text-right text-surface-300">{s.probability}%</td>
                <td className="py-2 text-right text-surface-400">{s.sortOrder}</td>
                <td className="py-2 text-right">
                  <button onClick={() => openEditStage(s)} aria-label={`Edit ${s.name}`}
                    className="p-1.5 rounded hover:bg-white/10 text-surface-300"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteStage(s)} aria-label={`Delete ${s.name}`}
                    className="p-1.5 rounded hover:bg-white/10 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
            {stages.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-surface-500">No stages yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Win and loss reasons */}
      <div className="glass-panel p-6">
        <div className="mb-4">
          <h2 className="text-white font-semibold">Win and loss reasons</h2>
          <p className="text-sm text-surface-400">
            Optional. Define none and the field never appears when closing a deal.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <Input label="Reason" value={reasonName} onChange={(e: any) => setReasonName(e.target.value)}
            placeholder="e.g. Price, Timing, Chose a competitor" />
          <Select label="Applies to" value={reasonType}
            onChange={(e: any) => setReasonType(e.target.value)}
            options={[{ value: 'loss', label: 'Loss' }, { value: 'win', label: 'Win' }]} />
          <Button onClick={addReason}>Add</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['win', 'loss'] as const).map(type => (
            <div key={type}>
              <h3 className="text-sm font-medium text-surface-200 mb-2 capitalize">{type} reasons</h3>
              <ul className="space-y-1">
                {reasons.filter(r => r.type === type).map(r => (
                  <li key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-white/5">
                    <span className={`text-sm ${r.isActive ? 'text-surface-200' : 'text-surface-500 line-through'}`}>
                      {r.name}
                    </span>
                    <button onClick={() => deleteReason(r)} aria-label={`Delete ${r.name}`}
                      className="p-1 rounded hover:bg-white/10 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
                {reasons.filter(r => r.type === type).length === 0 && (
                  <li className="text-xs text-surface-500 py-2">None defined</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={showStage} onClose={() => setShowStage(false)}
        title={editStageId ? 'Edit stage' : 'New stage'}
        footer={<>
          <Button variant="secondary" onClick={() => setShowStage(false)}>Cancel</Button>
          <Button loading={saving} onClick={saveStage}>{editStageId ? 'Save changes' : 'Create stage'}</Button>
        </>}>
        <div className="space-y-4">
          <Input label="Stage name" value={stageForm.name}
            onChange={(e: any) => setStageForm({ ...stageForm, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Outcome" value={stageForm.outcome}
              onChange={(e: any) => setStageForm({ ...stageForm, outcome: e.target.value })}
              options={[
                { value: 'open', label: 'Open, still in the funnel' },
                { value: 'won', label: 'Won, deal closed' },
                { value: 'lost', label: 'Lost, deal closed' },
              ]} />
            <Input label="Probability (%)" type="number" min="0" max="100" value={stageForm.probability}
              onChange={(e: any) => setStageForm({ ...stageForm, probability: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Colour" type="color" value={stageForm.color}
              onChange={(e: any) => setStageForm({ ...stageForm, color: e.target.value })} />
            <Input label="Order" type="number" value={stageForm.sortOrder}
              onChange={(e: any) => setStageForm({ ...stageForm, sortOrder: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
            <input type="checkbox" checked={stageForm.isDefault}
              onChange={(e) => setStageForm({ ...stageForm, isDefault: e.target.checked })} />
            Stage new opportunities start in
          </label>
        </div>
      </Modal>
    </div>
  );
}
