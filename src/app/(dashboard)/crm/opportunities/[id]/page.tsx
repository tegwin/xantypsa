'use client';

import { useEffect, useState } from 'react';
import { useReferenceFormat } from '@/hooks/useReferenceFormat';
import { useApi, apiPatch, apiPost, apiDelete } from '@/hooks/useApi';
import { PageHeader, StatusBadge, LoadingSpinner, Modal, Input, Select, Textarea, Button, Badge } from '@/components/ui';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Edit, Trash2, CheckCircle, XCircle, ArrowLeft, Building2, User,
  DollarSign, TrendingUp, Calendar, FileText, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Stages come from the tenant's own pipeline. This list is only the fallback
// for a tenant that has not defined any yet.
const FALLBACK_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const SOURCES = ['web', 'referral', 'cold-call', 'email', 'event', 'partner', 'other'];

export default function OpportunityDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { ref } = useReferenceFormat();
  const { data: opp, loading, refetch } = useApi<any>(`/api/opportunities/${id}`);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showWonModal, setShowWonModal] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [closeReasonId, setCloseReasonId] = useState('');
  const [convertProspect, setConvertProspect] = useState(true);

  const [stages, setStages] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [owners, setOwners] = useState<any[]>([]);

  // Notes panel
  const [noteText, setNoteText] = useState('');
  const [noteStage, setNoteStage] = useState('');
  const [noteReasonId, setNoteReasonId] = useState('');
  const [postingNote, setPostingNote] = useState(false);

  // Linking an existing ticket to this deal
  const [linkTicketId, setLinkTicketId] = useState('');
  const [openTickets, setOpenTickets] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/pipeline-stages').then(r => r.json())
      .then(d => setStages((d.items || []).filter((x: any) => x.isActive))).catch(() => {});
    fetch('/api/win-loss-reasons').then(r => r.json())
      .then(d => setReasons((d.items || []).filter((x: any) => x.isActive))).catch(() => {});
    fetch('/api/companies').then(r => r.json())
      .then(d => setCompanies(d.items || [])).catch(() => {});
    fetch('/api/users').then(r => r.json())
      .then(d => setOwners(d.items || [])).catch(() => {});
  }, []);

  // Contacts and tickets both hang off the company on the deal.
  const companyId = (editing ? form.companyId : opp?.companyId) || '';
  useEffect(() => {
    if (!companyId) { setContacts([]); setOpenTickets([]); return; }
    fetch(`/api/contacts?companyId=${companyId}`).then(r => r.json())
      .then(d => setContacts(d.items || [])).catch(() => setContacts([]));
    fetch(`/api/tickets?companyId=${companyId}&limit=100`).then(r => r.json())
      .then(d => setOpenTickets(d.items || [])).catch(() => setOpenTickets([]));
  }, [companyId]);

  if (loading) return <LoadingSpinner />;
  if (!opp) return <div className="p-8 text-slate-400">Opportunity not found</div>;

  const stageOptions = stages.length > 0
    ? stages.map((st: any) => ({ value: st.slug, label: st.name }))
    : FALLBACK_STAGES.map(st => ({ value: st, label: st.charAt(0).toUpperCase() + st.slice(1) }));

  const stageByName = (slug: string) =>
    stages.find((st: any) => st.slug === slug)?.name
    || slug.charAt(0).toUpperCase() + slug.slice(1);

  const addNote = async () => {
    if (!noteText.trim() && !noteStage) {
      toast.error('Add a note or choose a stage');
      return;
    }
    setPostingNote(true);
    try {
      await apiPost(`/api/opportunities/${id}/notes`, {
        content: noteText,
        stage: noteStage || undefined,
        reasonId: noteReasonId || undefined,
      });
      setNoteText(''); setNoteStage(''); setNoteReasonId('');
      toast.success('Added');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Could not add the note');
    } finally {
      setPostingNote(false);
    }
  };

  const linkTicket = async () => {
    if (!linkTicketId) return;
    try {
      await apiPatch(`/api/tickets/${linkTicketId}`, { opportunityId: id });
      setLinkTicketId('');
      toast.success('Ticket linked');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Could not link the ticket');
    }
  };

  const unlinkTicket = async (ticketId: string) => {
    try {
      await apiPatch(`/api/tickets/${ticketId}`, { opportunityId: null });
      toast.success('Ticket unlinked');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Could not unlink the ticket');
    }
  };

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
      ownerId: opp.ownerId || '',
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

  // Use the tenant's own won stage where one is defined, rather than assuming
  // a stage literally called "won".
  const wonSlug = stages.find((st: any) => st.isWon)?.slug || 'won';
  const lostSlug = stages.find((st: any) => st.isLost)?.slug || 'lost';

  const handleWon = async () => {
    try {
      await apiPatch(`/api/opportunities/${id}`, {
        stage: wonSlug,
        closedAt: new Date().toISOString(),
        reasonId: closeReasonId || null,
      });

      // Winning the deal is the natural moment a prospect becomes a customer.
      if (convertProspect && opp.company?.type === 'prospect') {
        await apiPatch(`/api/companies/${opp.companyId}`, { type: 'customer' });
        toast.success(`${opp.company.name} is now a customer`);
      }

      toast.success('Opportunity marked as won');
      setShowWonModal(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLost = async () => {
    try {
      await apiPatch(`/api/opportunities/${id}`, {
        stage: lostSlug,
        lostReason,
        reasonId: closeReasonId || null,
        closedAt: new Date().toISOString(),
      });
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
      <PageHeader
        title={editing ? 'Edit Opportunity' : opp.title}
        subtitle={[ref('opportunity', opp.opportunityNumber), opp.company?.name].filter(Boolean).join(' - ') || 'No company'}
      >
        <div className="flex gap-2 flex-wrap">
          {!editing && !['won', 'lost'].includes(opp.stage) && (
            <>
              <Button variant="primary" icon={<CheckCircle className="w-3.5 h-3.5" />} onClick={() => { setCloseReasonId(''); setShowWonModal(true); }}>Won</Button>
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
                <Select label="Stage" value={form.stage} onChange={update('stage')} options={stageOptions} />
                <Select label="Source" value={form.source} onChange={update('source')}
                  options={[{ value: '', label: '-- Select --' }, ...SOURCES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ') }))]} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Company" value={form.companyId}
                  onChange={(e: any) => setForm({ ...form, companyId: e.target.value, contactId: '' })}
                  options={[{ value: '', label: 'No company' }, ...companies.map((c: any) => ({ value: c.id, label: c.name }))]} />
                <Select label="Contact" value={form.contactId} onChange={update('contactId')}
                  options={[{ value: '', label: 'No contact' }, ...contacts.map((c: any) => ({
                    value: c.id,
                    label: c.name || [c.firstName, c.lastName].filter(Boolean).join(' '),
                  }))]} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Owner" value={form.ownerId || ''} onChange={update('ownerId')}
                  options={[{ value: '', label: 'Unassigned' }, ...owners.map((u: any) => ({ value: u.id, label: u.name }))]} />
                <Input label="Expected Close Date" type="date" value={form.expectedClose} onChange={update('expectedClose')} />
              </div>
              <Textarea label="Summary" value={form.notes} onChange={update('notes')} />
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

              {/* Notes, stage changes and linked work */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-white font-semibold mb-4">Notes and activity</h3>

                <textarea
                  className="w-full mb-3"
                  rows={3}
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <Select label="Move to stage" value={noteStage}
                    onChange={(e: any) => setNoteStage(e.target.value)}
                    options={[{ value: '', label: 'No change' }, ...stageOptions]} />

                  {/* Reasons only matter on a stage that closes the deal, and
                      only when the tenant has defined any. */}
                  {(() => {
                    const target = stages.find((st: any) => st.slug === noteStage);
                    const kind = target?.isWon ? 'win' : target?.isLost ? 'loss' : null;
                    const applicable = kind ? reasons.filter((r: any) => r.type === kind) : [];
                    if (!kind || applicable.length === 0) return <div />;
                    return (
                      <Select label={kind === 'win' ? 'Win reason' : 'Loss reason'} value={noteReasonId}
                        onChange={(e: any) => setNoteReasonId(e.target.value)}
                        options={[{ value: '', label: 'Not given' },
                          ...applicable.map((r: any) => ({ value: r.id, label: r.name }))]} />
                    );
                  })()}
                </div>

                <div className="flex justify-end mb-6">
                  <button onClick={addNote} disabled={postingNote || (!noteText.trim() && !noteStage)}
                    className="btn-primary text-sm disabled:opacity-50">
                    {postingNote ? 'Saving...' : 'Save'}
                  </button>
                </div>

                <div className="space-y-3">
                  {(opp.opportunityNotes || []).map((n: any) => (
                    <div key={n.id} className={`rounded-lg p-3 ${
                      n.isSystem ? 'bg-surface-800/40 border border-surface-700/30' : 'bg-surface-700/20 border border-surface-700/30'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white">{n.user?.name || 'System'}</span>
                        <span className="text-xs text-surface-500">{formatRelativeTime(n.createdAt)}</span>
                      </div>
                      <p className="text-sm text-surface-300 whitespace-pre-wrap">{n.content}</p>
                    </div>
                  ))}
                  {(!opp.opportunityNotes || opp.opportunityNotes.length === 0) && (
                    <p className="text-center text-sm text-surface-500 py-4">No notes yet</p>
                  )}
                </div>
              </div>

              {/* Linked tickets */}
              <div className="glass rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3">
                  Linked tickets ({opp.tickets?.length || 0})
                </h3>

                <div className="flex flex-wrap items-end gap-2 mb-4">
                  <Select label="Link an existing ticket" value={linkTicketId}
                    onChange={(e: any) => setLinkTicketId(e.target.value)}
                    options={[{ value: '', label: opp.companyId ? 'Choose a ticket' : 'Set a company on this deal first' },
                      ...openTickets
                        .filter((t: any) => !(opp.tickets || []).some((lt: any) => lt.id === t.id))
                        .map((t: any) => ({ value: t.id, label: `#${t.ticketNumber} ${t.title}` }))]} />
                  <Button onClick={linkTicket} disabled={!linkTicketId}>Link</Button>
                </div>

                <div className="space-y-2">
                  {(opp.tickets || []).map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50">
                      <Link href={`/service-desk/tickets/${t.id}`} className="text-sm text-white hover:text-brand-400">
                        #{t.ticketNumber} {t.title}
                      </Link>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={t.status} />
                        <button onClick={() => unlinkTicket(t.id)}
                          className="text-xs text-surface-400 hover:text-red-400 underline underline-offset-2">
                          Unlink
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!opp.tickets || opp.tickets.length === 0) && (
                    <p className="text-sm text-surface-500">No tickets linked to this deal.</p>
                  )}
                </div>
              </div>

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
      <Modal open={showWonModal} onClose={() => setShowWonModal(false)} title="Mark as won">
        <div className="space-y-4">
          {reasons.filter((r: any) => r.type === 'win').length > 0 && (
            <Select label="Win reason" value={closeReasonId}
              onChange={(e: any) => setCloseReasonId(e.target.value)}
              options={[{ value: '', label: 'Not given' },
                ...reasons.filter((r: any) => r.type === 'win').map((r: any) => ({ value: r.id, label: r.name }))]} />
          )}

          {opp.company?.type === 'prospect' && (
            <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={convertProspect}
                onChange={e => setConvertProspect(e.target.checked)} />
              <span>
                <span className="block">Convert {opp.company.name} to a customer</span>
                <span className="block text-xs text-surface-400">
                  Its contacts, tickets and opportunities stay exactly as they are.
                </span>
              </span>
            </label>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowWonModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleWon}>Mark as won</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showLostModal} onClose={() => setShowLostModal(false)} title="Mark as Lost">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Why was this opportunity lost?</p>
          {reasons.filter((r: any) => r.type === 'loss').length > 0 && (
            <Select label="Loss reason" value={closeReasonId}
              onChange={(e: any) => setCloseReasonId(e.target.value)}
              options={[{ value: '', label: 'Not given' },
                ...reasons.filter((r: any) => r.type === 'loss').map((r: any) => ({ value: r.id, label: r.name }))]} />
          )}
          <Textarea
            label="Notes"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Anything worth recording beyond the reason above"
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
