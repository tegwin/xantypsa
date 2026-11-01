'use client';

import { useState, useEffect, useRef } from 'react';
import { useApi, apiPatch, apiPost } from '@/hooks/useApi';
import { useSession } from '@/components/SessionProvider';
import Link from 'next/link';
import { useTicketTimer } from '@/hooks/useTicketTimer';
import { PageHeader, StatusBadge, LoadingSpinner, Avatar, Badge, Modal, Input, Textarea, Select } from '@/components/ui';
import { formatDate, formatRelativeTime, formatCurrency } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import { Clock, DollarSign, ChevronDown, ChevronUp, Moon, Mail, EyeOff, Play, Pause, RotateCcw, Pencil } from 'lucide-react';
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
  // Public or private is chosen from the action bar at the top of the ticket.
  // The composer then shows the options that belong to that kind of note.
  const [noteMode, setNoteMode] = useState<'public' | 'internal'>('public');
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const [emailCustomer, setEmailCustomer] = useState(false);

  // A technician can see that a ticket is on a contract without being able to
  // open the contract itself, which carries rates and margin.
  const { data: appSession } = useSession();
  const canViewContracts =
    !!appSession?.user?.isSuperAdmin ||
    (appSession?.user?.permissions ?? []).includes('contracts:view');
  // Ticket edit modal
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [contractOptions, setContractOptions] = useState<{ id: string; name: string }[]>([]);

  const [timerSettings, setTimerSettings] = useState({
    timerEnabled: true,
    timerOnlyOnTimeEntry: false,
    timerOnlyOnPublicNotes: false,
  });
  const [showTimeEntry, setShowTimeEntry] = useState(false);
  // Entered in hours, because that is how people think about a day's work.
  // Minutes stay the unit everywhere else, derived from this.
  const [timeHours, setTimeHours] = useState('');
  // While true the minutes field tracks the timer. Typing a figure by hand, or
  // picking a quick value, hands control back to the person.
  const [minutesFollowTimer, setMinutesFollowTimer] = useState(true);
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
    fetch('/api/companies').then(r => r.json()).then(data => {
      setCompanies((data.items || []).map((c: any) => ({ id: c.id, name: c.name })));
    }).catch(() => {});
    fetch('/api/settings/service-desk').then(r => r.json()).then(data => {
      setTimerSettings({
        timerEnabled: data.timerEnabled ?? true,
        timerOnlyOnTimeEntry: data.timerOnlyOnTimeEntry ?? false,
        timerOnlyOnPublicNotes: data.timerOnlyOnPublicNotes ?? false,
      });
    }).catch(() => {});
  }, []);

  const isInternalMode = noteMode === 'internal';

  // With neither option set the timer simply runs. Each option is a condition
  // that has to hold for it to keep running.
  const timerShouldRun =
    timerSettings.timerEnabled &&
    (!timerSettings.timerOnlyOnTimeEntry || showTimeEntry) &&
    (!timerSettings.timerOnlyOnPublicNotes || !isInternalMode);

  const timer = useTicketTimer(typeof id === 'string' ? id : undefined);

  // The settings decide when the timer may run; manual pause still wins until
  // the conditions change again.
  const { start: startTimer, pause: pauseTimer, running: timerRunning } = timer;
  useEffect(() => {
    if (timerShouldRun && !timerRunning) startTimer();
    if (!timerShouldRun && timerRunning) pauseTimer();
    // Only react to the conditions changing, not to every manual toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerShouldRun]);

  // Contacts are per company, so the list reloads whenever the company changes
  // in the edit form rather than being fetched once.
  useEffect(() => {
    const companyId = editForm?.companyId;
    if (!editing || !companyId) { setContacts([]); setContractOptions([]); return; }
    fetch(`/api/contacts?companyId=${companyId}`)
      .then(r => r.json())
      .then(data => setContacts((data.items || []).map((c: any) => ({
        id: c.id,
        name: c.name || [c.firstName, c.lastName].filter(Boolean).join(' '),
      }))))
      .catch(() => setContacts([]));

    fetch(`/api/contracts?companyId=${companyId}`)
      .then(r => r.json())
      .then(data => setContractOptions((data.items || []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => setContractOptions([]));
  }, [editing, editForm?.companyId]);

  // Minutes tracks the running clock, so the field is already right when the
  // note is saved rather than needing the elapsed time pushed into it.
  useEffect(() => {
    if (!minutesFollowTimer || !timer.running) return;
    setTimeHours(timer.minutes > 0 ? (timer.minutes / 60).toFixed(2) : '');
  }, [timer.minutes, timer.running, minutesFollowTimer]);

  // Calculate billing preview
  useEffect(() => {
    const mins = Math.round((parseFloat(timeHours) || 0) * 60);
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
  }, [timeHours, billingRateId, billable, isOOH, billingRates]);

  const toggleNoteVisibility = async (noteId: string, makeInternal: boolean) => {
    setTogglingNote(noteId);
    try {
      await apiPatch(`/api/tickets/${id}/notes`, { noteId, isInternal: makeInternal });
      toast.success(makeInternal ? 'Note is now private' : 'Note is now public');
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Could not change the note');
    } finally {
      setTogglingNote(null);
    }
  };

  const handleSubmit = async (asInternal: boolean) => {
    if (!noteText.trim() && !timeHours && !newStatus) {
      toast.error('Add a note, time entry, or change status');
      return;
    }
    setSubmitting(true);
    try {
      const result: any = await apiPost(`/api/tickets/${id}/notes`, {
        content: noteText,
        isInternal: asInternal,
        emailCustomer: !asInternal && emailCustomer,
        timeMinutes: showTimeEntry ? Math.round((parseFloat(timeHours) || 0) * 60) : undefined,
        billingRateId: showTimeEntry && billable ? billingRateId : undefined,
        billable: showTimeEntry ? billable : undefined,
        isOOH: showTimeEntry ? isOOH : undefined,
        newStatus: newStatus || undefined,
      });
      toast.success(noteText.trim() ? (asInternal ? 'Private note added' : 'Public note added') : 'Updated');
      // The note is saved either way; a failed send is reported separately so
      // it is never mistaken for the note itself failing.
      if (result?.emailError) toast.error(`Note saved, but not emailed: ${result.emailError}`);
      else if (result?.emailed) toast.success('Emailed to the customer');
      setNoteText('');
      setTimeHours('');
      setMinutesFollowTimer(true);
      setNewStatus('');
      setShowTimeEntry(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const quickTime = (hours: number) => { setMinutesFollowTimer(false); setTimeHours(String(hours)); };

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

  const nothingToSave = !noteText.trim() && !timeHours && !newStatus;


  // Jump to the composer and put the cursor in it, so the action bar at the
  // top behaves like a shortcut into the note rather than just a toggle.
  const startNote = (mode: 'public' | 'internal') => {
    setNoteMode(mode);
    noteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    noteRef.current?.focus({ preventScroll: true });
  };

  // Shown in the action bar and again inside the time entry panel.
  const timerWidget = timerSettings.timerEnabled ? (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border ${
      timer.running ? 'border-brand-500/40 bg-brand-500/10' : 'border-surface-600'
    }`}>
      <Clock className={`h-4 w-4 ${timer.running ? 'text-brand-400' : 'text-surface-500'}`} />
      <span className="font-mono text-sm text-white tabular-nums">{timer.formatted}</span>
      <button
        onClick={() => (timer.running ? timer.pause() : timer.start())}
        aria-label={timer.running ? 'Pause timer' : 'Start timer'}
        className="p-1 rounded hover:bg-white/10 text-surface-300"
      >
        {timer.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={timer.reset}
        aria-label="Reset timer"
        className="p-1 rounded hover:bg-white/10 text-surface-400"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  ) : null;

  const openEdit = () => {
    setEditForm({
      title: ticket.title || '',
      description: ticket.description || '',
      priority: ticket.priority || 'medium',
      type: ticket.type || '',
      category: ticket.category || '',
      companyId: ticket.companyId || '',
      contactId: ticket.contactId || '',
      contractId: ticket.contractId || '',
      dueDate: ticket.dueDate ? String(ticket.dueDate).slice(0, 10) : '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editForm?.title?.trim()) {
      toast.error('A ticket needs a title');
      return;
    }
    setSavingEdit(true);
    try {
      await apiPatch(`/api/tickets/${id}`, {
        ...editForm,
        dueDate: editForm.dueDate || null,
        category: editForm.category || null,
        contactId: editForm.contactId || null,
        companyId: editForm.companyId || null,
        contractId: editForm.contractId || null,
      });
      toast.success('Ticket updated');
      setEditing(false);
      await refetch();
    } catch (err: any) {
      toast.error(err.message || 'Could not update the ticket');
    } finally {
      setSavingEdit(false);
    }
  };

  const saveButton = (
    <button
      onClick={() => handleSubmit(isInternalMode)}
      disabled={submitting || nothingToSave}
      className={`text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
        isInternalMode
          ? 'border border-amber-500/40 text-amber-300 hover:bg-amber-500/10'
          : 'btn-primary'
      }`}
    >
      {submitting ? 'Saving...' : isInternalMode ? 'Save private note' : 'Save public note'}
    </button>
  );

  return (
    <div className="animate-fadeIn">
      <PageHeader title={`${ticket.ticketNumber}`} subtitle={ticket.title}>
        <button onClick={() => router.push('/service-desk/tickets')} className="btn-secondary">← Back</button>
      </PageHeader>

      {/* Action bar: choosing here sets what the composer below is writing. */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => startNote('public')}
          aria-pressed={!isInternalMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
            !isInternalMode
              ? 'bg-green-500/15 border-green-500/40 text-green-300'
              : 'border-surface-600 text-surface-400 hover:border-surface-500'
          }`}
        >
          <Mail className="h-4 w-4" />
          Public Note
        </button>
        <button
          onClick={() => startNote('internal')}
          aria-pressed={isInternalMode}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
            isInternalMode
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              : 'border-surface-600 text-surface-400 hover:border-surface-500'
          }`}
        >
          <EyeOff className="h-4 w-4" />
          Private Note
        </button>
        <button
          onClick={openEdit}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-surface-600 text-surface-300 hover:border-surface-500 transition-colors"
        >
          <Pencil className="h-4 w-4" />
          Edit Ticket
        </button>
        {timerWidget && <div className="ml-auto">{timerWidget}</div>}
      </div>

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
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold">Add Note / Time</h3>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  isInternalMode ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
                }`}>
                  {isInternalMode ? 'Private note' : 'Public note'}
                </span>
              </div>
              {saveButton}
            </div>

            <textarea ref={noteRef} className="w-full mb-3" rows={3}
              placeholder={isInternalMode ? 'Private note, not visible to the customer...' : 'Public note, visible to the customer...'}
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
              <div className={`rounded-lg p-4 mb-4 space-y-3 border transition-colors ${
                isInternalMode
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-green-500/5 border-green-500/30'
              }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-brand-400" />
                    <span className="text-sm font-medium text-surface-200">Time Entry</span>
                  </div>
                  {/* The time is saved as part of the note, so it carries the
                      visibility chosen in the action bar at the top. */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isInternalMode ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {isInternalMode ? 'Private' : 'Public'}
                    </span>
                    {timerWidget}
                    {timerSettings.timerEnabled && timer.seconds > 0 && (
                      <button
                        onClick={() => { setMinutesFollowTimer(true); setTimeHours((timer.minutes / 60).toFixed(2)); }}
                        className={`text-xs px-2 py-1 rounded border ${
                          minutesFollowTimer
                            ? 'border-brand-500/40 text-brand-300 bg-brand-500/10'
                            : 'border-surface-600 text-surface-400 hover:border-surface-500'
                        }`}
                        title="Keep the minutes field in step with the timer"
                      >
                        {minutesFollowTimer
                          ? `Tracking ${(timer.minutes / 60).toFixed(2)}h`
                          : `Use ${(timer.minutes / 60).toFixed(2)}h`}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-surface-400 mb-1">Hours</label>
                    <input type="number" value={timeHours} step="0.25" min="0"
                      onChange={(e) => { setMinutesFollowTimer(false); setTimeHours(e.target.value); }}
                      placeholder="0" />
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[0.25, 0.5, 0.75, 1, 2, 4, 8].map(h => (
                        <button key={h} onClick={() => quickTime(h)} type="button"
                          className={`px-2 py-0.5 text-xs rounded transition-colors ${
                            timeHours === String(h) ? 'bg-brand-500/30 text-brand-400 border border-brand-500/30' : 'bg-surface-700 text-surface-400 hover:bg-surface-600'
                          }`}>
                          {h}h
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

                {/* Billing preview. Work on a pre-pay or managed contract is
                    already paid for, so showing a charge would be wrong. */}
                {billable && (parseFloat(timeHours) || 0) > 0 && preview.rate > 0 && (() => {
                  const contract = ticket.contract;
                  const isPrepay = contract?.type === 'prepay_hours';
                  const isManaged = contract?.type === 'managed_service';
                  const remaining = (contract?.totalHours || 0) - (contract?.hoursUsed || 0);
                  const hoursHere = preview.billableMinutes / 60;
                  const over = isPrepay ? Math.max(0, hoursHere - Math.max(0, remaining)) : 0;
                  const covered = hoursHere - over;

                  return (
                    <div className="bg-surface-900/50 border border-surface-700/30 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex justify-between text-surface-400">
                        <span>Actual time:</span><span>{timeHours}h</span>
                      </div>
                      <div className="flex justify-between text-surface-300">
                        <span>Billed time (after min/rounding):</span><span className="font-medium">{(preview.billableMinutes / 60).toFixed(2)}h</span>
                      </div>

                      {isPrepay ? (
                        <>
                          <div className="flex justify-between text-surface-300">
                            <span>From the block:</span>
                            <span>{covered.toFixed(2)}h of {Math.max(0, remaining).toFixed(1)}h left</span>
                          </div>
                          <div className="flex justify-between text-white font-semibold border-t border-surface-700/50 pt-1 mt-1">
                            <span>Charge:</span>
                            {over > 0 && contract?.overhourRate != null ? (
                              <span className="text-amber-400">
                                £{(over * contract.overhourRate).toFixed(2)} for {over.toFixed(2)}h over the block
                              </span>
                            ) : over > 0 ? (
                              <span className="text-amber-400">
                                £{(over * preview.rate).toFixed(2)} for {over.toFixed(2)}h over the block,
                                at the normal rate
                              </span>
                            ) : (
                              <span className="text-purple-300">Deducted from pre-pay</span>
                            )}
                          </div>
                        </>
                      ) : isManaged ? (
                        <div className="flex justify-between text-white font-semibold border-t border-surface-700/50 pt-1 mt-1">
                          <span>Charge:</span>
                          <span className="text-green-400">Covered by the managed service</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-surface-300">
                            <span>Rate{isOOH ? ' (OOH)' : ''}:</span><span>£{preview.rate.toFixed(2)}/hr</span>
                          </div>
                          <div className="flex justify-between text-white font-semibold border-t border-surface-700/50 pt-1 mt-1">
                            <span>Billed amount:</span><span className="text-green-400">£{preview.total.toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Status Change. A dropdown rather than a row of buttons: the
                list is as long as the tenant's own status list, which a row
                cannot hold. */}
            {availableStatuses.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <label htmlFor="ticket-status" className="text-xs text-surface-400 shrink-0">
                  Change status
                </label>
                <select
                  id="ticket-status"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="bg-surface-800 border border-surface-700 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">No change</option>
                  {availableStatuses.map(st => {
                    const custom = customStatuses.find(cs => cs.slug === st);
                    return (
                      <option key={st} value={st}>
                        {custom?.name || st.charAt(0).toUpperCase() + st.slice(1)}
                      </option>
                    );
                  })}
                </select>
                {newStatus && (() => {
                  const custom = customStatuses.find(cs => cs.slug === newStatus);
                  const color = custom?.color || '#3b82f6';
                  return (
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{ backgroundColor: color + '30', color }}>
                      {custom?.name || newStatus}
                    </span>
                  );
                })()}
              </div>
            )}

            {!isInternalMode && (
              <label className="flex items-center gap-2 mb-3 text-sm text-surface-300 cursor-pointer">
                <input type="checkbox" checked={emailCustomer}
                  onChange={e => setEmailCustomer(e.target.checked)} />
                <Mail className="h-3.5 w-3.5 text-surface-400" />
                Also email this note to the customer
              </label>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-surface-500">
                {isInternalMode
                  ? 'Private notes stay on the ticket. The customer never sees them.'
                  : 'Public notes are visible to the customer in the portal.'}
              </p>
              {saveButton}
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
                          {note.isInternal ? 'Private' : 'Public'}
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
                            : note.isInternal ? 'Make public' : 'Make private'}
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
              {canViewContracts ? (
                <Link href={`/contracts/${ticket.contract.id}`}
                  className="block text-blue-400 font-medium hover:text-blue-300 text-xs mb-3">
                  {ticket.contract.name} &rarr;
                </Link>
              ) : (
                <div className="text-white text-xs mb-3">{ticket.contract.name}</div>
              )}

              {/* Prominent hours display for block contracts. Shown for every
                  pre-pay contract, including a monthly one whose first block
                  has not been raised yet. */}
              {(ticket.contract.type === 'prepay_hours' || ticket.contract.totalHours != null) && (
                <div className="bg-surface-800/80 rounded-lg p-3 mb-2">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-lg font-bold text-white">{(ticket.contract.hoursUsed || 0).toFixed(1)}h</span>
                    <span className="text-surface-400 text-sm">of {(ticket.contract.totalHours || 0).toFixed(1)}h used</span>
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
                    {((ticket.contract.totalHours || 0) - (ticket.contract.hoursUsed || 0)).toFixed(1)}h remaining
                  </div>

                  {!ticket.contract.totalHours && (
                    <p className="text-xs text-surface-500 mt-1.5">
                      {ticket.contract.blockMode === 'monthly'
                        ? `No block raised for this month yet${ticket.contract.hoursPerPeriod ? `. ${ticket.contract.hoursPerPeriod}h due` : ''}.`
                        : 'No hours on this block yet.'}
                    </p>
                  )}

                  {ticket.contract.overhourRate != null && (
                    <p className="text-xs text-surface-500 mt-1">
                      Over the block: {formatCurrency(ticket.contract.overhourRate)}/hr
                    </p>
                  )}
                  {ticket.contract.overhourRate == null && (ticket.contract.totalHours || 0) > 0 && (
                    <p className="text-xs text-surface-500 mt-1">
                      Over the block: charged at the normal rate.
                    </p>
                  )}
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

      {editing && editForm && (
        <Modal
          isOpen={editing}
          onClose={() => setEditing(false)}
          title="Edit ticket"
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit} className="btn-primary text-sm disabled:opacity-50">
                {savingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <Input label="Title" value={editForm.title}
              onChange={(e: any) => setEditForm({ ...editForm, title: e.target.value })} />

            <Textarea label="Description" rows={5} value={editForm.description}
              onChange={(e: any) => setEditForm({ ...editForm, description: e.target.value })} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Company" value={editForm.companyId}
                onChange={(e: any) => setEditForm({ ...editForm, companyId: e.target.value, contactId: '', contractId: '' })}
                options={[{ value: '', label: 'No company' }, ...companies.map(c => ({ value: c.id, label: c.name }))]} />

              <Select label="Contact" value={editForm.contactId}
                onChange={(e: any) => setEditForm({ ...editForm, contactId: e.target.value })}
                options={[{ value: '', label: 'No contact' }, ...contacts.map(c => ({ value: c.id, label: c.name }))]} />

              <Select label="Priority" value={editForm.priority}
                onChange={(e: any) => setEditForm({ ...editForm, priority: e.target.value })}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]} />

              <Select label="Type" value={editForm.type}
                onChange={(e: any) => setEditForm({ ...editForm, type: e.target.value })}
                options={[
                  { value: 'incident', label: 'Incident' },
                  { value: 'request', label: 'Request' },
                  { value: 'problem', label: 'Problem' },
                  { value: 'change', label: 'Change' },
                ]} />

              <Select label="Contract" value={editForm.contractId}
                onChange={(e: any) => setEditForm({ ...editForm, contractId: e.target.value })}
                options={[{ value: '', label: 'No contract' }, ...contractOptions.map(c => ({ value: c.id, label: c.name }))]} />

              <Input label="Category" value={editForm.category}
                onChange={(e: any) => setEditForm({ ...editForm, category: e.target.value })} />

              <Input label="Due date" type="date" value={editForm.dueDate}
                onChange={(e: any) => setEditForm({ ...editForm, dueDate: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
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
