'use client';

import { useState, useEffect } from 'react';
import { useApi, apiPatch, apiPost } from '@/hooks/useApi';
import { PageHeader, StatusBadge, LoadingSpinner, Avatar, Badge } from '@/components/ui';
import { formatDate, formatRelativeTime, formatCurrency } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import { Clock, DollarSign, ChevronDown, ChevronUp, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

interface BillingRate {
  id: string; name: string; code: string; rate: number;
  minimumMinutes: number; roundingMinutes: number; oohMultiplier: number;
}

export default function TicketDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: ticket, loading, refetch } = useApi<any>(`/api/tickets/${id}`);
  const [billingRates, setBillingRates] = useState<BillingRate[]>([]);
  const [customStatuses, setCustomStatuses] = useState<{ slug: string; name: string; color: string; isClosed: boolean }[]>([]);

  // Note + Time form state
  const [noteText, setNoteText] = useState('');
  // Note id currently being switched between public and internal.
  const [togglingNote, setTogglingNote] = useState<string | null>(null);
  const [showTimeEntry, setShowTimeEntry] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState('');
  const [billingRateId, setBillingRateId] = useState('');
  const [billable, setBillable] = useState(true);
  const [isOOH, setIsOOH] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState<{id:string;name:string}[]>([]);

  // Billing preview
  const [preview, setPreview] = useState({ billableMinutes: 0, rate: 0, total: 0 });

  useEffect(() => {
    fetch('/api/billing-rates').then(r => r.json()).then(data => {
      const rates = (data.items || []).filter((r: any) => r.isActive);
      setBillingRates(rates);
      const defaultRate = rates.find((r: any) => r.isDefault);
      if (defaultRate) setBillingRateId(defaultRate.id);
    });
    fetch('/api/ticket-statuses').then(r => r.json()).then(data => {
      setCustomStatuses((data.items || []).filter((s: any) => s.isActive));
    });
    fetch('/api/users').then(r => r.json()).then(data => {
      setAgents((data.items || []).map((u: any) => ({ id: u.id, name: u.name })));
    }).catch(() => {});
  }, []);

  // Calculate billing preview
  useEffect(() => {
    const mins = parseInt(timeMinutes) || 0;
    if (mins <= 0 || !billable) {
      setPreview({ billableMinutes: 0, rate: 0, total: 0 });
      return;
    }
    const rate = billingRates.find(r => r.id === billingRateId);
    if (!rate) {
      setPreview({ billableMinutes: mins, rate: 0, total: 0 });
      return;
    }
    let billableMins = mins;
    if (billableMins < rate.minimumMinutes) billableMins = rate.minimumMinutes;
    if (rate.roundingMinutes > 0) billableMins = Math.ceil(billableMins / rate.roundingMinutes) * rate.roundingMinutes;
    const actualRate = isOOH ? rate.rate * rate.oohMultiplier : rate.rate;
    const total = (billableMins / 60) * actualRate;
    setPreview({ billableMinutes: billableMins, rate: actualRate, total });
  }, [timeMinutes, billingRateId, billable, isOOH, billingRates]);

  const toggleNoteVisibility = async (noteId: string, makeInternal: boolean) => {
    setTogglingNote(noteId);
    try {
      await apiPatch(`/api/tickets/${id}/notes`, { noteId, isInternal: makeInternal });
      toast.success(makeInternal ? 'Note is now internal' : 'Note is now public');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Could not change the note');
    } finally {
      setTogglingNote(null);
    }
  };

  const handleSubmit = async (asInternal: boolean) => {
    if (!noteText.trim() && !timeMinutes && !newStatus) {
      toast.error('Add a note, time entry, or change status');
      return;
    }
    setSubmitting(true);
    try {
      await apiPost(`/api/tickets/${id}/notes`, {
        content: noteText,
        isInternal: asInternal,
        timeMinutes: showTimeEntry ? timeMinutes : undefined,
        billingRateId: showTimeEntry && billable ? billingRateId : undefined,
        billable: showTimeEntry ? billable : undefined,
        isOOH: showTimeEntry ? isOOH : undefined,
        newStatus: newStatus || undefined,
      });
      toast.success(noteText.trim() ? (asInternal ? 'Internal note added' : 'Public note added') : 'Updated');
      setNoteText('');
      setTimeMinutes('');
      setNewStatus('');
      setShowTimeEntry(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const quickTime = (mins: number) => setTimeMinutes(mins.toString());

  if (loading) return <LoadingSpinner />;
  if (!ticket) return <div className="text-surface-400 p-8">Ticket not found</div>;

  // Dynamic status transitions - allow moving to any non-current status
  const availableStatuses = customStatuses.length > 0
    ? customStatuses.filter(s => s.slug !== ticket.status).map(s => s.slug)
    : (() => {
        const flow: Record<string, string[]> = {
          new: ['open', 'pending'],
          open: ['pending', 'resolved', 'closed'],
          pending: ['open', 'resolved', 'closed'],
          resolved: ['open', 'closed'],
          closed: ['open'],
        };
        return flow[ticket.status] || [];
      })();

  // Calculate billing totals
  const totalBilled = ticket.timeEntries?.reduce((sum: number, te: any) => sum + (te.billedAmount || 0), 0) || 0;
  const totalHours = ticket.timeEntries?.reduce((sum: number, te: any) => sum + (te.hours || 0), 0) || 0;
  const unbilledEntries = ticket.timeEntries?.filter((te: any) => !te.billed && te.billable) || [];
  const unbilledTotal = unbilledEntries.reduce((sum: number, te: any) => sum + (te.billedAmount || 0), 0);

  return (
    <div className="animate-fadeIn">
      <PageHeader title={`${ticket.ticketNumber}`} subtitle={ticket.title}>
        <button onClick={() => router.push('/service-desk/tickets')} className="btn-secondary">← Back</button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {ticket.description && (
            <div className="glass-panel p-6">
              <h3 className="text-white font-semibold mb-3">Description</h3>
              <p className="text-surface-300 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {/* === ADD NOTE / TIME / STATUS === */}
          <div className="glass-panel p-6">
            <h3 className="text-white font-semibold mb-4">Add Note / Time</h3>

            <textarea className="w-full mb-3" rows={3} placeholder="Add a note..."
              value={noteText} onChange={(e) => setNoteText(e.target.value)} />

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button onClick={() => setShowTimeEntry(!showTimeEntry)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                  showTimeEntry ? 'bg-brand-500/20 border-brand-500/30 text-brand-400' : 'border-surface-600 text-surface-400 hover:border-surface-500'
                }`}>
                <Clock className="h-3.5 w-3.5" />
                Add Time
                {showTimeEntry ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {/* Time Entry Section */}
            {showTimeEntry && (
              <div className="bg-surface-800/80 border border-surface-700/50 rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-brand-400" />
                  <span className="text-sm font-medium text-surface-200">Time Entry</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-surface-400 mb-1">Minutes</label>
                    <input type="number" value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)}
                      placeholder="0" min="1" />
                    <div className="flex gap-1 mt-1.5">
                      {[15, 30, 45, 60, 90, 120].map(m => (
                        <button key={m} onClick={() => quickTime(m)} type="button"
                          className={`px-2 py-0.5 text-xs rounded transition-colors ${
                            timeMinutes === m.toString() ? 'bg-brand-500/30 text-brand-400 border border-brand-500/30' : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                          }`}>
                          {m >= 60 ? `${m/60}h` : `${m}m`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-surface-400 mb-1">Billing Rate</label>
                    <select value={billingRateId} onChange={(e) => setBillingRateId(e.target.value)} disabled={!billable}>
                      <option value=""> - No rate - </option>
                      {billingRates.map(r => (
                        <option key={r.id} value={r.id}>{r.name} (£{r.rate.toFixed(2)}/hr)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
                    <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
                    Billable
                  </label>
                  <label className={`flex items-center gap-2 text-sm cursor-pointer ${isOOH ? 'text-amber-400' : 'text-surface-400'}`}>
                    <input type="checkbox" checked={isOOH} onChange={(e) => setIsOOH(e.target.checked)} disabled={!billable} />
                    <Moon className="h-3.5 w-3.5" />
                    Out of Hours
                  </label>
                </div>

                {/* Billing Preview */}
                {billable && parseInt(timeMinutes) > 0 && preview.rate > 0 && (
                  <div className="bg-surface-900/50 border border-surface-700/30 rounded-lg p-3 text-xs space-y-1">
                    <div className="flex justify-between text-surface-400">
                      <span>Actual time:</span><span>{timeMinutes} mins</span>
                    </div>
                    <div className="flex justify-between text-surface-300">
                      <span>Billed time (after min/rounding):</span><span className="font-medium">{preview.billableMinutes} mins</span>
                    </div>
                    <div className="flex justify-between text-surface-300">
                      <span>Rate{isOOH ? ' (OOH)' : ''}:</span><span>£{preview.rate.toFixed(2)}/hr</span>
                    </div>
                    <div className="flex justify-between text-white font-semibold border-t border-surface-700/50 pt-1 mt-1">
                      <span>Billed amount:</span><span className="text-green-400">£{preview.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Status Change */}
            {availableStatuses.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-surface-400">Change status:</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setNewStatus('')}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${!newStatus ? 'bg-surface-600 text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'}`}>
                    No change
                  </button>
                  {availableStatuses.map(s => {
                    const custom = customStatuses.find(cs => cs.slug === s);
                    const label = custom?.name || (s.charAt(0).toUpperCase() + s.slice(1));
                    const color = custom?.color || '#3b82f6';
                    return (
                      <button key={s} onClick={() => setNewStatus(s)}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors border ${
                          newStatus === s ? 'font-medium' : 'bg-surface-800 text-surface-400 hover:bg-surface-700 border-transparent'
                        }`}
                        style={newStatus === s ? { backgroundColor: color + '30', color, borderColor: color + '50' } : {}}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end items-center gap-2">
              <p className="text-xs text-surface-500 mr-auto">
                A public note is visible to the customer. An internal note is not.
              </p>
              <button onClick={() => handleSubmit(true)} disabled={submitting || (!noteText.trim() && !timeMinutes && !newStatus)}
                className="text-sm px-4 py-2 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save internal note'}
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting || (!noteText.trim() && !timeMinutes && !newStatus)}
                className="btn-primary text-sm disabled:opacity-50">
                {submitting ? 'Saving...' : 'Save public note'}
              </button>
            </div>
          </div>

          {/* Notes & Activity */}
          <div className="glass-panel p-6">
            <h3 className="text-white font-semibold mb-4">Activity Timeline</h3>
            <div className="space-y-3">
              {ticket.notes?.map((note: any) => (
                <div key={note.id}
                  className={`rounded-lg p-4 ${
                    note.isSystem ? 'bg-surface-800/30 border border-surface-700/30'
                    : note.isInternal ? 'bg-amber-500/5 border border-amber-500/10'
                    : 'bg-surface-700/20 border border-surface-700/30'
                  }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={note.user?.name || 'System'} size="sm" />
                      <span className="text-white text-sm font-medium">{note.user?.name || 'System'}</span>
                      {!note.isSystem && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          note.isInternal
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}>
                          {note.isInternal ? 'Internal' : 'Public'}
                        </span>
                      )}
                      {note.isSystem && <span className="text-xs bg-surface-600/50 text-surface-400 px-1.5 py-0.5 rounded">System</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!note.isSystem && (
                        <button
                          onClick={() => toggleNoteVisibility(note.id, !note.isInternal)}
                          disabled={togglingNote === note.id}
                          className="text-xs text-surface-400 hover:text-white underline underline-offset-2 disabled:opacity-50"
                        >
                          {togglingNote === note.id
                            ? 'Changing...'
                            : note.isInternal ? 'Make public' : 'Make internal'}
                        </button>
                      )}
                      <span className="text-xs text-surface-500">{formatRelativeTime(note.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-surface-300 text-sm whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
              {(!ticket.notes || ticket.notes.length === 0) && (
                <div className="text-center text-surface-500 py-4">No activity yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-white font-semibold">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-surface-400">Status</span>
                {(() => {
                  const cs = customStatuses.find(s => s.slug === ticket.status);
                  if (cs) return <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cs.color + '20', color: cs.color }}>{cs.name}</span>;
                  return <StatusBadge status={ticket.status} />;
                })()}
              </div>
              <div className="flex justify-between"><span className="text-surface-400">Priority</span><StatusBadge status={ticket.priority} /></div>
              <div className="flex justify-between"><span className="text-surface-400">Type</span><span className="text-white capitalize">{ticket.type?.replace('_', ' ') || ' - '}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Company</span><span className="text-white">{ticket.company?.name || ' - '}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Contact</span><span className="text-white">{ticket.contact ? `${ticket.contact.firstName} ${ticket.contact.lastName}` : ' - '}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-surface-400">Assignee</span>
                <select value={ticket.assignedToId || ''} onChange={async (e) => { await apiPatch(`/api/tickets/${id}`, { assignedToId: e.target.value || null }); refetch(); }}
                  className="text-xs bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-white max-w-[160px] cursor-pointer hover:border-blue-500/50 transition-colors">
                  <option value="">Unassigned</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="flex justify-between"><span className="text-surface-400">Category</span><span className="text-white capitalize">{ticket.category || ' - '}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-surface-400">Contract</span>
                <ContractSelector ticketId={ticket.id} companyId={ticket.companyId} currentContractId={ticket.contractId} contractName={ticket.contract?.name} onUpdate={refetch} />
              </div>
              <div className="flex justify-between"><span className="text-surface-400">Created</span><span className="text-white">{formatDate(ticket.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Created By</span><span className="text-white">{ticket.createdBy?.name || ' - '}</span></div>
              {ticket.resolvedAt && <div className="flex justify-between"><span className="text-surface-400">Resolved</span><span className="text-green-400">{formatDate(ticket.resolvedAt)}</span></div>}
              {ticket.closedAt && <div className="flex justify-between"><span className="text-surface-400">Closed</span><span className="text-green-400">{formatDate(ticket.closedAt)}</span></div>}
            </div>
          </div>

          {/* Billing Summary */}
          <div className="glass-panel p-6">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-brand-400" />
              <h3 className="text-white font-semibold">Billing</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-surface-400">Total Time</span><span className="text-white">{totalHours.toFixed(1)}h</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Billable Amount</span><span className="text-white">£{totalBilled.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Unbilled</span><span className="text-amber-400 font-medium">£{unbilledTotal.toFixed(2)}</span></div>
            </div>
          </div>

          {/* Contract Info (if assigned) */}
          {ticket.contract && (
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📋</span>
                  <h3 className="text-white font-semibold text-sm">Contract</h3>
                </div>
                <span className="text-[10px] capitalize px-1.5 py-0.5 rounded bg-surface-700 text-surface-300">{ticket.contract.type?.replace(/_/g, ' ')}</span>
              </div>
              <div className="text-blue-400 font-medium cursor-pointer hover:text-blue-300 text-xs mb-3"
                onClick={() => router.push(`/contracts/${ticket.contract.id}`)}>
                {ticket.contract.name} →
              </div>

              {/* Prominent hours display for block contracts */}
              {ticket.contract.totalHours != null && (
                <div className="bg-surface-800/80 rounded-lg p-3 mb-2">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-lg font-bold text-white">{(ticket.contract.hoursUsed || 0).toFixed(1)}h</span>
                    <span className="text-surface-400 text-sm">of {ticket.contract.totalHours}h</span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-700 rounded-full overflow-hidden">
                    {(() => {
                      const pct = ticket.contract.totalHours ? ((ticket.contract.hoursUsed || 0) / ticket.contract.totalHours * 100) : 0;
                      return <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />;
                    })()}
                  </div>
                  <div className={`text-xs font-medium mt-1.5 text-right ${
                    (ticket.contract.totalHours - (ticket.contract.hoursUsed || 0)) <= 0 ? 'text-red-400' :
                    ((ticket.contract.hoursUsed || 0) / ticket.contract.totalHours * 100) > 80 ? 'text-amber-400' : 'text-green-400'
                  }`}>
                    {(ticket.contract.totalHours - (ticket.contract.hoursUsed || 0)).toFixed(1)}h remaining
                  </div>
                </div>
              )}

              {/* Managed service label */}
              {ticket.contract.type === 'managed_service' && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-xs text-green-400 text-center">
                  All labour covered by monthly service
                </div>
              )}

              {/* Deductions from this ticket */}
              {ticket.timeEntries?.some((te: any) => te.chargeType === 'contract') && (
                <div className="mt-3 pt-2 border-t border-surface-700/50">
                  <div className="text-xs text-surface-500 mb-1">This ticket deducted:</div>
                  <div className="text-sm font-semibold text-purple-400">
                    {(ticket.timeEntries.filter((te: any) => te.chargeType === 'contract').reduce((sum: number, te: any) => sum + (te.minutes || te.hours * 60), 0) / 60).toFixed(1)}h
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Time Entries */}
          {ticket.timeEntries?.length > 0 && (
            <div className="glass-panel p-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-brand-400" />
                <h3 className="text-white font-semibold">Time Entries</h3>
              </div>
              <div className="space-y-2">
                {ticket.timeEntries.map((te: any) => (
                  <div key={te.id} className="bg-surface-800/50 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">{te.minutes || Math.round(te.hours * 60)} mins</span>
                      <div className="flex items-center gap-1.5">
                        {te.isOOH && <Moon className="h-3 w-3 text-amber-400" />}
                        {te.billed ? (
                          <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Billed</span>
                        ) : te.billable ? (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Unbilled</span>
                        ) : (
                          <span className="text-xs bg-surface-600/50 text-surface-400 px-1.5 py-0.5 rounded">Non-billable</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-surface-400">{te.user?.name} · {te.billingRate?.name || 'No rate'}</span>
                      <div className="flex items-center gap-1.5">
                        {te.chargeType === 'contract' && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">Block</span>}
                        {te.chargeType === 'excluded' && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1 py-0.5 rounded">T&M</span>}
                        {te.billedAmount > 0 && <span className="text-green-400 font-medium">£{te.billedAmount.toFixed(2)}</span>}
                        {te.chargeType === 'contract' && <span className="text-purple-400 font-medium text-[10px]">Covered</span>}
                      </div>
                    </div>
                    <span className="text-xs text-surface-500">{formatDate(te.date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Contract selector for ticket sidebar
function ContractSelector({ ticketId, companyId, currentContractId, contractName, onUpdate }: {
  ticketId: string; companyId?: string; currentContractId?: string; contractName?: string; onUpdate: () => void;
}) {
  const { data: contractsData } = useApi<any>(companyId ? `/api/contracts?companyId=${companyId}&status=active&limit=50` : null);
  const [saving, setSaving] = useState(false);

  const handleChange = async (contractId: string) => {
    setSaving(true);
    try {
      await apiPatch(`/api/tickets/${ticketId}`, { contractId: contractId || null });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const contracts = contractsData?.items || [];
  const typeLabel = (t: string) => {
    const labels: Record<string, string> = { time_and_materials: 'T&M', fixed_price: 'Fixed', prepay_hours: 'Block', managed_service: 'Managed' };
    return labels[t] || t;
  };

  return (
    <select
      value={currentContractId || ''}
      onChange={(e) => handleChange(e.target.value)}
      disabled={saving}
      className="text-xs bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-white max-w-[200px] cursor-pointer hover:border-blue-500/50 transition-colors"
    >
      <option value="">No contract</option>
      {contracts.map((c: any) => (
        <option key={c.id} value={c.id}>{c.name} ({typeLabel(c.type)})</option>
      ))}
      {contracts.length === 0 && companyId && <option disabled>No active contracts for this company</option>}
    </select>
  );
}
