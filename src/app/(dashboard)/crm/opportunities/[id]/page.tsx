'use client';

import { useState } from 'react';
import { useApi, apiPatch, apiDelete } from '@/hooks/useApi';
import { PageHeader, StatusBadge, LoadingSpinner, Modal, Input, Select, Textarea, Button, Badge } from '@/components/ui';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Edit, Trash2, CheckCircle, XCircle, ArrowLeft, Building2, User,
  DollarSign, TrendingUp, Calendar, FileText, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const SOURCES = ['web', 'referral', 'cold-call', 'email', 'event', 'partner', 'other'];

export default function OpportunityDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: opp, loading, refetch } = useApi<any>(`/api/opportunities/${id}`);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState('');

  if (loading) return <LoadingSpinner />;
  if (!opp) return <div className="p-8 text-slate-400">Opportunity not found</div>;

  const startEdit = () => {
    setForm({
      title: opp.title || '',
      value: opp.value || 0,
      stage: opp.stage || 'lead',
      probability: opp.probability || 0,
      expectedClose: opp.expectedClose ? new Date(opp.expectedClose).toISOString().split('T')[0] : '',
      source: opp.source || '',
      notes: opp.notes || '',
      companyId: opp.companyId || '',
      contactId: opp.contactId || '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/opportunities/${id}`, {
        ...form,
        value: parseFloat(form.value),
        probability: parseInt(form.probability),
        expectedClose: form.expectedClose || null,
      });
      setEditing(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleWon = async () => {
    try {
      await apiPatch(`/api/opportunities/${id}`, { stage: 'won', closedAt: new Date().toISOString() });
      toast.success('Opportunity marked as Won!');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLost = async () => {
    try {
      await apiPatch(`/api/opportunities/${id}`, { stage: 'lost', lostReason, closedAt: new Date().toISOString() });
      toast.success('Opportunity marked as Lost');
      setShowLostModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    await apiDelete(`/api/opportunities/${id}`);
    router.push('/crm/opportunities');
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev: any) => ({ ...prev, [field]: e.target.value }));

  const stageColor = (stage: string) => {
    switch (stage) {
      case 'won': return 'text-green-400';
      case 'lost': return 'text-red-400';
      case 'negotiation': return 'text-amber-400';
      case 'proposal': return 'text-blue-400';
      case 'qualified': return 'text-purple-400';
      default: return 'text-surface-300';
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title={editing ? 'Edit Opportunity' : opp.title} subtitle={opp.company?.name || 'No company'}>
        <div className="flex gap-2 flex-wrap">
          {!editing && !['won', 'lost'].includes(opp.stage) && (
            <>
              <Button variant="primary" icon={<CheckCircle className="w-3.5 h-3.5" />} onClick={handleWon}>Won</Button>
              <Button variant="danger" icon={<XCircle className="w-3.5 h-3.5" />} onClick={() => setShowLostModal(true)}>Lost</Button>
              <Button variant="secondary" icon={<Edit className="w-3.5 h-3.5" />} onClick={startEdit}>Edit</Button>
            </>
          )}
          {!editing && (
            <>
              <Button variant="ghost" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setShowDelete(true)}>Delete</Button>
              <Button variant="secondary" icon={<ArrowLeft className="w-3.5 h-3.5" />} onClick={() => router.push('/crm/opportunities')}>Back</Button>
            </>
          )}
          {editing && (
            <>
              <Button loading={saving} onClick={handleSave}>Save Changes</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {editing ? (
            /* Edit Form */
            <div className="glass rounded-xl p-6 space-y-4">
              <Input label="Title" value={form.title} onChange={update('title')} required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Value" type="number" value={form.value} onChange={update('value')} />
                <Input label="Probability (%)" type="number" min="0" max="100" value={form.probability} onChange={update('probability')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Stage" value={form.stage} onChange={update('stage')}
                  options={STAGES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
                <Select label="Source" value={form.source} onChange={update('source')}
                  options={[{ value: '', label: '-- Select --' }, ...SOURCES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ') }))]} />
              </div>
              <Input label="Expected Close Date" type="date" value={form.expectedClose} onChange={update('expectedClose')} />
              <Textarea label="Notes" value={form.notes} onChange={update('notes')} />
            </div>
          ) : (
            /* View Mode */
            <>
              {/* Stage + Value Hero */}
              <div className="glass rounded-xl p-6">
                <div className="flex items-center gap-4 flex-wrap">
                  <Badge variant="status" status={opp.stage} className="text-base px-3 py-1">
                    <span className={stageColor(opp.stage)}>{opp.stage.charAt(0).toUpperCase() + opp.stage.slice(1)}</span>
                  </Badge>
                  <span className="text-2xl font-bold text-white">{formatCurrency(opp.value)}</span>
                  <span className="text-sm text-surface-400">{opp.probability}% probability</span>
                  {opp.expectedClose && (
                    <span className="text-sm text-surface-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Close: {formatDate(opp.expectedClose)}
                    </span>
                  )}
                </div>
              </div>

              {/* Notes */}
              {opp.notes && (
                <div className="glass rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{opp.notes}</p>
                </div>
              )}

              {/* Prospect / Custom Data */}
              {opp.customData && Object.keys(opp.customData).length > 0 && opp.customData.prospectName && (
                <div className="glass rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-3">Prospect Information</h3>
                  <div className="space-y-2 text-sm">
                    {opp.customData.prospectName && (
                      <div className="flex justify-between"><span className="text-slate-400">Name</span><span className="text-white">{opp.customData.prospectName}</span></div>
                    )}
                    {opp.customData.prospectEmail && (
                      <div className="flex justify-between"><span className="text-slate-400">Email</span><span className="text-white">{opp.customData.prospectEmail}</span></div>
                    )}
                    {opp.customData.prospectPhone && (
                      <div className="flex justify-between"><span className="text-slate-400">Phone</span><span className="text-white">{opp.customData.prospectPhone}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Lost Reason */}
              {opp.stage === 'lost' && opp.lostReason && (
                <div className="glass rounded-xl p-6 border border-red-600/20">
                  <h3 className="text-red-400 font-semibold mb-2">Lost Reason</h3>
                  <p className="text-sm text-slate-300">{opp.lostReason}</p>
                </div>
              )}

              {/* Linked Quotes */}
              {opp.quotes && opp.quotes.length > 0 && (
                <div className="glass rounded-xl p-6">
                  <h3 className="text-white font-semibold mb-3">Linked Quotes ({opp.quotes.length})</h3>
                  <div className="space-y-2">
                    {opp.quotes.map((q: any) => (
                      <Link key={q.id} href={`/quotes/${q.id}`}
                        className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-surface-400" />
                          <span className="text-sm text-white">{q.title || q.quoteNumber}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={q.status} />
                          <span className="text-sm text-surface-300">{formatCurrency(q.total)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass rounded-xl p-6 space-y-3">
            <h3 className="text-white font-semibold">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Stage</span>
                <span className={stageColor(opp.stage) + ' font-medium capitalize'}>{opp.stage}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Value</span>
                <span className="text-white font-medium">{formatCurrency(opp.value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Probability</span>
                <span className="text-white">{opp.probability}%</span>
              </div>
              {opp.source && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Source</span>
                  <span className="text-white capitalize">{opp.source}</span>
                </div>
              )}
              {opp.company && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Company</span>
                  <Link href={`/crm/companies/${opp.company.id}`} className="text-brand-400 hover:text-brand-300">
                    {opp.company.name}
                  </Link>
                </div>
              )}
              {opp.contact && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Contact</span>
                  <Link href={`/crm/contacts/${opp.contact.id}`} className="text-brand-400 hover:text-brand-300">
                    {opp.contact.firstName} {opp.contact.lastName}
                  </Link>
                </div>
              )}
              {opp.owner && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Owner</span>
                  <span className="text-white">{opp.owner.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="glass rounded-xl p-6 space-y-3">
            <h3 className="text-white font-semibold">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Created</span>
                <span className="text-slate-300">{formatRelativeTime(opp.createdAt)}</span>
              </div>
              {opp.expectedClose && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Expected Close</span>
                  <span className="text-slate-300">{formatDate(opp.expectedClose)}</span>
                </div>
              )}
              {opp.closedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Closed</span>
                  <span className="text-slate-300">{formatRelativeTime(opp.closedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Updated</span>
                <span className="text-slate-300">{formatRelativeTime(opp.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="glass rounded-xl p-6 space-y-3">
            <h3 className="text-white font-semibold">Quick Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Weighted Value</span>
                <span className="text-white font-medium">{formatCurrency(opp.value * opp.probability / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Quotes</span>
                <span className="text-white">{opp._count?.quotes || opp.quotes?.length || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Opportunity">
        <p className="text-slate-300 mb-6">Are you sure you want to delete <strong className="text-white">{opp.title}</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>

      {/* Lost Reason Modal */}
      <Modal open={showLostModal} onClose={() => setShowLostModal(false)} title="Mark as Lost">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Why was this opportunity lost?</p>
          <Textarea
            label="Lost Reason"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="e.g. Budget constraints, chose competitor, timing..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowLostModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleLost}>Mark as Lost</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
