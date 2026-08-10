'use client';

import { useState } from 'react';
import { useApi, apiPatch, apiPost, apiDelete } from '@/hooks/useApi';
import ContractItemsPanel from '@/components/contracts/ContractItemsPanel';
import { PageHeader, StatusBadge, LoadingSpinner, Modal } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { FileText, Plus, CheckCircle, Receipt, ChevronDown, ChevronUp, Trash2, Link2 } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  time_and_materials: 'Time & Materials',
  fixed_price: 'Fixed Price',
  prepay_hours: 'Pre-Pay Hours',
  managed_service: 'Monthly Service',
};
const TYPE_COLORS: Record<string, string> = {
  time_and_materials: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  fixed_price: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  prepay_hours: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  managed_service: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  invoiced: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export default function ContractDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: contract, loading, refetch } = useApi<any>(`/api/contracts/${id}`);
  const [showTopup, setShowTopup] = useState(false);
  const [topupHours, setTopupHours] = useState('');
  const [topupNote, setTopupNote] = useState('');

  // Milestone billing state
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    description: '', amount: '', dueDate: '', projectMilestoneId: '',
  });
  const [billingAllRemaining, setBillingAllRemaining] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<string | null>(null);

  // Fetch project milestones for linking
  const { data: projectsData, refetch: refetchProjects } = useApi<any>(
    contract?.companyId ? `/api/projects?companyId=${contract.companyId}&limit=100` : null
  );

  // Create project milestone inline
  const [showCreateProjectMilestone, setShowCreateProjectMilestone] = useState(false);
  const [pmForm, setPmForm] = useState({ projectId: '', name: '', description: '', dueDate: '' });
  const [pmSaving, setPmSaving] = useState(false);

  const handleCreateProjectMilestone = async () => {
    if (!pmForm.projectId || !pmForm.name) return;
    setPmSaving(true);
    const res = await apiPost(`/api/projects/${pmForm.projectId}/milestones`, {
      name: pmForm.name,
      description: pmForm.description || null,
      dueDate: pmForm.dueDate || null,
    });
    setPmSaving(false);
    if (res) {
      toast.success('Project milestone created');
      setPmForm({ projectId: '', name: '', description: '', dueDate: '' });
      setShowCreateProjectMilestone(false);
      refetchProjects();
    }
  };

  const handleStatusChange = async (status: string) => {
    await apiPatch(`/api/contracts/${id}`, { status });
    refetch();
  };

  const handleDelete = async () => {
    if (confirm('Delete this contract? This cannot be undone.')) {
      await apiDelete(`/api/contracts/${id}`);
      router.push('/contracts/list');
    }
  };

  const handleTopup = async () => {
    const hours = parseFloat(topupHours);
    if (!hours || hours <= 0) { toast.error('Enter a valid number of hours'); return; }
    const newTotal = (contract.totalHours || 0) + hours;
    await apiPatch(`/api/contracts/${id}`, { totalHours: newTotal, notes: `${contract.notes || ''}${contract.notes ? '\n' : ''}[Topup] +${hours}h added on ${new Date().toLocaleDateString('en-GB')}${topupNote ? ': ' + topupNote : ''}` });
    setShowTopup(false);
    setTopupHours('');
    setTopupNote('');
    refetch();
  };

  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const handleGenerateInvoice = async () => {
    setGeneratingInvoice(true);
    try {
      const res = await apiPost(`/api/contracts/${id}/generate-invoice`, {});
      if (res?.id) {
        toast.success('Invoice generated successfully');
        router.push(`/invoices/${res.id}`);
      }
    } catch {
      toast.error('Failed to generate invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Milestone billing handlers
  const handleAddMilestone = async () => {
    if (!milestoneForm.amount || !milestoneForm.dueDate) {
      toast.error('Amount and due date are required');
      return;
    }
    try {
      await apiPost(`/api/contracts/${id}/instalments`, {
        description: milestoneForm.description || null,
        amount: parseFloat(milestoneForm.amount),
        dueDate: milestoneForm.dueDate,
        projectMilestoneId: milestoneForm.projectMilestoneId || null,
      });
      setShowAddMilestone(false);
      setMilestoneForm({ description: '', amount: '', dueDate: '', projectMilestoneId: '' });
      refetch();
    } catch {
      toast.error('Failed to add milestone');
    }
  };

  const handleInvoiceMilestone = async (instalment: any) => {
    try {
      const res = await apiPost(`/api/contracts/${id}/instalments/${instalment.id}`, {});
      if (res?.id) {
        toast.success('Invoice created for milestone');
        refetch();
      }
    } catch {
      toast.error('Failed to create invoice');
    }
  };

  const handleMarkPaid = async (instalment: any) => {
    try {
      await apiPatch(`/api/contracts/${id}/instalments/${instalment.id}`, { status: 'paid' });
      refetch();
    } catch {
      toast.error('Failed to mark as paid');
    }
  };

  const handleDeleteMilestone = async (instalment: any) => {
    if (!confirm('Delete this milestone?')) return;
    try {
      await apiDelete(`/api/contracts/${id}/instalments/${instalment.id}`);
      refetch();
    } catch {
      toast.error('Failed to delete milestone');
    }
  };

  const handleLinkProjectMilestone = async (instalment: any, projectMilestoneId: string) => {
    try {
      await apiPatch(`/api/contracts/${id}/instalments/${instalment.id}`, {
        projectMilestoneId: projectMilestoneId || null,
      });
      refetch();
    } catch {
      toast.error('Failed to link milestone');
    }
  };

  const handleBillAllRemaining = async () => {
    setBillingAllRemaining(true);
    try {
      const pendingInstalments = contract.instalments?.filter((i: any) => i.status === 'pending') || [];
      for (const inst of pendingInstalments) {
        await apiPost(`/api/contracts/${id}/instalments/${inst.id}`, {});
      }
      toast.success(`Created invoices for ${pendingInstalments.length} milestone(s)`);
      refetch();
    } catch {
      toast.error('Failed to bill all remaining milestones');
    } finally {
      setBillingAllRemaining(false);
    }
  };

  const handleInvoiceInstalment = async (instalment: any) => {
    const res = await apiPost('/api/invoices', {
      companyId: contract.companyId,
      title: `${contract.name} - Instalment ${instalment.number}`,
      lineItems: [{
        description: `${contract.name} - Instalment ${instalment.number} of ${contract.instalmentCount}`,
        quantity: 1,
        unitPrice: instalment.amount,
        taxRate: 20,
      }],
    });
    if (res) refetch();
  };

  if (loading) return <LoadingSpinner />;
  if (!contract) return <div className="text-surface-400 p-8">Contract not found</div>;

  const hoursUsed = contract.hoursUsedCalc || contract.hoursUsed || 0;
  const hoursPct = contract.totalHours ? (hoursUsed / contract.totalHours * 100) : 0;
  const hoursRemaining = contract.totalHours ? Math.max(0, contract.totalHours - hoursUsed) : null;

  // Group time entries by ticket for deductions view
  const deductionsByTicket: Record<string, { ticket: any; entries: any[]; totalMins: number }> = {};
  if (contract.timeEntries) {
    for (const te of contract.timeEntries) {
      const key = te.ticket?.id || 'no-ticket';
      if (!deductionsByTicket[key]) {
        deductionsByTicket[key] = { ticket: te.ticket, entries: [], totalMins: 0 };
      }
      deductionsByTicket[key].entries.push(te);
      deductionsByTicket[key].totalMins += te.minutes || Math.round(te.hours * 60);
    }
  }

  // Milestone billing calculations
  const instalments = contract.instalments || [];
  const contractValue = contract.fixedPrice || contract.value || 0;
  const totalInvoiced = instalments
    .filter((i: any) => i.status === 'invoiced' || i.status === 'paid')
    .reduce((s: number, i: any) => s + i.amount, 0);
  const totalPaid = instalments
    .filter((i: any) => i.status === 'paid')
    .reduce((s: number, i: any) => s + i.amount, 0);
  const totalPending = instalments
    .filter((i: any) => i.status === 'pending')
    .reduce((s: number, i: any) => s + i.amount, 0);
  const invoicedPct = contractValue > 0 ? (totalInvoiced / contractValue * 100) : 0;
  const paidPct = contractValue > 0 ? (totalPaid / contractValue * 100) : 0;
  const pendingCount = instalments.filter((i: any) => i.status === 'pending').length;

  // Collect all project milestones for linking dropdown
  const allProjectMilestones: { id: string; name: string; projectName: string }[] = [];
  if (projectsData?.items) {
    for (const proj of projectsData.items) {
      if (proj.milestones) {
        for (const ms of proj.milestones) {
          allProjectMilestones.push({ id: ms.id, name: ms.name, projectName: proj.name });
        }
      }
    }
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title={contract.contractNumber} subtitle={contract.name}>
        <div className="flex gap-2 flex-wrap">
          {contract.status === 'draft' && <button onClick={() => handleStatusChange('active')} className="btn-primary text-sm">Activate</button>}
          {contract.status === 'active' && <button onClick={() => handleStatusChange('suspended')} className="btn-secondary text-sm text-amber-400">Suspend</button>}
          {contract.status === 'suspended' && <button onClick={() => handleStatusChange('active')} className="btn-primary text-sm">Reactivate</button>}
          {contract.type === 'prepay_hours' && contract.status === 'active' && (
            <button onClick={() => setShowTopup(true)} className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/30 text-sm font-medium transition-colors">
              + Top Up Hours
            </button>
          )}
          {contract.status === 'active' && (
            <button onClick={handleGenerateInvoice} disabled={generatingInvoice}
              className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/30 text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50">
              <FileText className="w-3.5 h-3.5" />
              {generatingInvoice ? 'Generating...' : 'Generate Invoice'}
            </button>
          )}
          <button onClick={handleDelete} className="btn-secondary text-sm text-red-400">Delete</button>
          <button onClick={() => router.push('/contracts/list')} className="btn-secondary text-sm">← Back</button>
        </div>
      </PageHeader>

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-surface-400 mb-1">Type</div>
          <div className={`inline-flex px-3 py-1 rounded-lg border text-sm font-medium ${TYPE_COLORS[contract.type] || ''}`}>
            {TYPE_LABELS[contract.type] || contract.type}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-surface-400 mb-1">Status</div>
          <StatusBadge status={contract.status} />
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-surface-400 mb-1">Value</div>
          <div className="text-white font-semibold text-lg">
            {contract.type === 'fixed_price' && formatCurrency(contract.fixedPrice || contract.value)}
            {contract.type === 'prepay_hours' && `${contract.totalHours}h block`}
            {contract.type === 'managed_service' && `${formatCurrency(contract.monthlyFee || contract.value)}/mo`}
            {contract.type === 'time_and_materials' && 'T&M'}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-xs text-surface-400 mb-1">Company</div>
          <div className="text-white font-medium">{contract.company?.name || '—'}</div>
        </div>
      </div>

      <div className="mb-6">
        <ContractItemsPanel
          contractId={contract.id}
          billingCycle={contract.billingCycle}
          onSaved={refetch}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Pre-Pay Hours Block Usage */}
          {contract.type === 'prepay_hours' && (
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Hours Block Usage</h3>
                <button onClick={() => setShowTopup(true)} className="text-xs text-purple-400 hover:text-purple-300">+ Top Up</button>
              </div>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-surface-400">{hoursUsed.toFixed(1)}h used of {contract.totalHours}h</span>
                  <span className={`font-medium ${hoursPct > 90 ? 'text-red-400' : hoursPct > 70 ? 'text-amber-400' : 'text-green-400'}`}>
                    {hoursRemaining?.toFixed(1)}h remaining ({(100 - hoursPct).toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-4 bg-surface-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${hoursPct > 90 ? 'bg-red-500' : hoursPct > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(hoursPct, 100)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><div className="text-surface-500">Block Price</div><div className="text-white font-medium">{formatCurrency(contract.value)}</div></div>
                <div><div className="text-surface-500">Effective Rate</div><div className="text-white font-medium">{contract.totalHours ? formatCurrency(contract.value / contract.totalHours) + '/hr' : '—'}</div></div>
                <div><div className="text-surface-500">Overage Rate</div><div className="text-white font-medium">{contract.overhourRate ? formatCurrency(contract.overhourRate) + '/hr' : 'No overages'}</div></div>
              </div>
            </div>
          )}

          {/* Deduction History */}
          {(contract.type === 'prepay_hours' || contract.type === 'managed_service') && Object.keys(deductionsByTicket).length > 0 && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">
                Deductions
                <span className="text-surface-500 font-normal text-sm ml-2">
                  ({contract.timeEntries?.length || 0} entries, {(contract.timeEntries?.reduce((s: number, te: any) => s + (te.minutes || te.hours * 60), 0) / 60 || 0).toFixed(1)}h total)
                </span>
              </h3>
              <div className="space-y-3">
                {Object.values(deductionsByTicket).map((group: any, i: number) => (
                  <div key={i} className="rounded-lg border border-surface-700/50 overflow-hidden">
                    <div className="flex items-center justify-between bg-surface-800/50 px-4 py-2.5 cursor-pointer hover:bg-surface-800/80"
                      onClick={() => group.ticket && router.push(`/service-desk/tickets/${group.ticket.id}`)}>
                      <div className="flex items-center gap-2">
                        {group.ticket ? (
                          <>
                            <span className="font-mono text-xs text-blue-400">#{group.ticket.ticketNumber}</span>
                            <span className="text-sm text-white">{group.ticket.title}</span>
                          </>
                        ) : (
                          <span className="text-sm text-surface-400">Direct entries</span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-purple-400">{(group.totalMins / 60).toFixed(1)}h</span>
                    </div>
                    <div className="divide-y divide-surface-700/30">
                      {group.entries.map((te: any) => (
                        <div key={te.id} className="flex items-center justify-between px-4 py-2 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="text-surface-400 w-20">{formatDate(te.date)}</span>
                            <span className="text-surface-300">{te.user?.name}</span>
                            <span className="text-surface-500">{te.billingRate?.name || ''}</span>
                          </div>
                          <span className="text-white font-medium">{te.minutes || Math.round(te.hours * 60)} mins</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== MILESTONE BILLING SECTION ===== */}
          {contract.type === 'fixed_price' && (
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-400" />
                  Milestone Billing
                </h3>
                <div className="flex items-center gap-2">
                  {pendingCount > 1 && (
                    <button
                      onClick={handleBillAllRemaining}
                      disabled={billingAllRemaining}
                      className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    >
                      {billingAllRemaining ? 'Billing...' : `Bill All Remaining (${pendingCount})`}
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddMilestone(true)}
                    className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Milestone
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-surface-400">
                    {formatCurrency(totalInvoiced)} invoiced of {formatCurrency(contractValue)}
                  </span>
                  <span className="text-surface-400">
                    {formatCurrency(totalPaid)} paid ({paidPct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-surface-700 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-blue-500/40 rounded-full absolute left-0 top-0 transition-all"
                    style={{ width: `${Math.min(invoicedPct, 100)}%` }}
                  />
                  <div
                    className="h-full bg-green-500 rounded-full absolute left-0 top-0 transition-all"
                    style={{ width: `${Math.min(paidPct, 100)}%` }}
                  />
                </div>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" /> Paid
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500/40" /> Invoiced
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-surface-700" /> Pending
                  </span>
                </div>
              </div>

              {/* Milestones list */}
              {instalments.length > 0 ? (
                <div className="space-y-2">
                  {instalments.map((inst: any) => (
                    <div key={inst.id} className="rounded-lg border border-surface-700/50 overflow-hidden">
                      <div
                        className="flex items-center justify-between p-3 bg-surface-800/50 hover:bg-surface-800/80 cursor-pointer transition-colors"
                        onClick={() => setExpandedMilestone(expandedMilestone === inst.id ? null : inst.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-medium ${STATUS_COLORS[inst.status] || 'bg-surface-700 text-surface-400'}`}>
                            {inst.number}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium text-sm">
                                {inst.description || `Milestone ${inst.number}`}
                              </span>
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[inst.status]}`}>
                                {inst.status}
                              </span>
                            </div>
                            <div className="text-xs text-surface-500 mt-0.5">
                              {formatCurrency(inst.amount)} &middot; Due {formatDate(inst.dueDate)}
                              {inst.projectMilestoneId && (
                                <span className="ml-2 text-blue-400">
                                  <Link2 className="w-3 h-3 inline" /> Linked to project
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {inst.status === 'pending' && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleInvoiceMilestone(inst); }}
                                className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" /> Invoice
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteMilestone(inst); }}
                                className="text-xs text-red-400/60 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {inst.status === 'invoiced' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMarkPaid(inst); }}
                              className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded bg-green-500/10 hover:bg-green-500/20 transition-colors flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" /> Mark Paid
                            </button>
                          )}
                          {expandedMilestone === inst.id ? <ChevronUp className="w-4 h-4 text-surface-500" /> : <ChevronDown className="w-4 h-4 text-surface-500" />}
                        </div>
                      </div>

                      {/* Expanded details */}
                      {expandedMilestone === inst.id && (
                        <div className="p-3 border-t border-surface-700/50 bg-surface-900/50 space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-surface-500">Amount</span>
                              <div className="text-white font-medium">{formatCurrency(inst.amount)}</div>
                            </div>
                            <div>
                              <span className="text-surface-500">Due Date</span>
                              <div className="text-white">{formatDate(inst.dueDate)}</div>
                            </div>
                            <div>
                              <span className="text-surface-500">Status</span>
                              <div><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[inst.status]}`}>{inst.status}</span></div>
                            </div>
                            {inst.paidAt && (
                              <div>
                                <span className="text-surface-500">Paid At</span>
                                <div className="text-white">{formatDate(inst.paidAt)}</div>
                              </div>
                            )}
                          </div>

                          {/* Link to project milestone */}
                          {allProjectMilestones.length > 0 && inst.status === 'pending' && (
                            <div>
                              <label className="text-xs text-surface-500 block mb-1">Link to Project Phase/Milestone</label>
                              <select
                                className="input w-full text-sm"
                                value={inst.projectMilestoneId || ''}
                                onChange={(e) => handleLinkProjectMilestone(inst, e.target.value)}
                              >
                                <option value="">-- None --</option>
                                {allProjectMilestones.map((ms) => (
                                  <option key={ms.id} value={ms.id}>
                                    {ms.projectName} &rarr; {ms.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {inst.projectMilestoneId && inst.status !== 'pending' && (
                            <div className="text-xs text-blue-400 flex items-center gap-1">
                              <Link2 className="w-3 h-3" />
                              Linked to project milestone: {allProjectMilestones.find(m => m.id === inst.projectMilestoneId)?.name || inst.projectMilestoneId}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-surface-500 text-sm mb-3">No milestones configured yet</p>
                  <button
                    onClick={() => setShowAddMilestone(true)}
                    className="text-sm text-blue-400 hover:text-blue-300 px-4 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                  >
                    + Add First Milestone
                  </button>
                </div>
              )}

              {/* Summary row */}
              {instalments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-surface-700/50 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-surface-500">Total Scheduled</div>
                    <div className="text-white font-semibold">{formatCurrency(instalments.reduce((s: number, i: any) => s + i.amount, 0))}</div>
                  </div>
                  <div>
                    <div className="text-surface-500">Pending</div>
                    <div className="text-amber-400 font-semibold">{formatCurrency(totalPending)}</div>
                  </div>
                  <div>
                    <div className="text-surface-500">Contract Value</div>
                    <div className="text-white font-semibold">{formatCurrency(contractValue)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Exclusions */}
          {contract.exclusions?.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Rate Exclusions</h3>
              <p className="text-sm text-surface-400 mb-3">These billing rates are excluded from this contract and charged as T&M:</p>
              <div className="flex flex-wrap gap-2">
                {contract.exclusions.map((ex: any) => (
                  <span key={ex.id} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                    {ex.billingRate.name} ({ex.billingRate.code}) — {formatCurrency(ex.billingRate.rate)}/hr → T&M
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Linked Tickets */}
          {contract.tickets?.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Linked Tickets ({contract._count?.tickets || 0})</h3>
              <div className="space-y-2">
                {contract.tickets.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors cursor-pointer"
                    onClick={() => router.push(`/service-desk/tickets/${t.id}`)}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-blue-400">#{t.ticketNumber}</span>
                      <span className="text-white text-sm">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      {t.timeSpent > 0 && <span className="text-xs text-surface-400">{(t.timeSpent / 60).toFixed(1)}h</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass rounded-xl p-6 space-y-3">
            <h3 className="text-white font-semibold">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-surface-400">Status</span><StatusBadge status={contract.status} /></div>
              <div className="flex justify-between"><span className="text-surface-400">Start Date</span><span className="text-white">{formatDate(contract.startDate)}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">End Date</span><span className="text-white">{contract.endDate ? formatDate(contract.endDate) : 'No end date'}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Billing Cycle</span><span className="text-white capitalize">{contract.billingCycle}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Auto-Renew</span><span className="text-white">{contract.autoRenew ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Tickets</span><span className="text-white">{contract._count?.tickets || 0}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Time Entries</span><span className="text-white">{contract._count?.timeEntries || 0}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Invoices</span><span className="text-white">{contract._count?.invoices || 0}</span></div>
              <div className="flex justify-between"><span className="text-surface-400">Created</span><span className="text-white">{formatDate(contract.createdAt)}</span></div>
            </div>
          </div>

          {/* Milestone sidebar summary for fixed price */}
          {contract.type === 'fixed_price' && instalments.length > 0 && (
            <div className="glass rounded-xl p-6 space-y-3">
              <h3 className="text-white font-semibold">Billing Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-surface-400">Milestones</span>
                  <span className="text-white">{instalments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Pending</span>
                  <span className="text-amber-400">{pendingCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Invoiced</span>
                  <span className="text-blue-400">{instalments.filter((i: any) => i.status === 'invoiced').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Paid</span>
                  <span className="text-green-400">{instalments.filter((i: any) => i.status === 'paid').length}</span>
                </div>
                <div className="border-t border-surface-700/50 pt-2 flex justify-between">
                  <span className="text-surface-400">Invoiced Total</span>
                  <span className="text-white font-medium">{formatCurrency(totalInvoiced)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Remaining</span>
                  <span className="text-white font-medium">{formatCurrency(totalPending)}</span>
                </div>
              </div>
            </div>
          )}

          {contract.notes && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-2">Notes</h3>
              <p className="text-sm text-surface-400 whitespace-pre-wrap">{contract.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Milestone Modal */}
      <Modal isOpen={showAddMilestone} onClose={() => setShowAddMilestone(false)} title="Add Milestone">
        <div className="space-y-4">
          <div>
            <label className="label">Description</label>
            <input className="input w-full" value={milestoneForm.description}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
              placeholder="e.g. Phase 1 - Discovery & Planning" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount *</label>
              <input className="input w-full" type="number" step="0.01" min="0" value={milestoneForm.amount}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, amount: e.target.value })}
                placeholder="0.00" />
            </div>
            <div>
              <label className="label">Due Date *</label>
              <input className="input w-full" type="date" value={milestoneForm.dueDate}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Link to Project Milestone</label>
            {allProjectMilestones.length > 0 ? (
              <select className="input w-full" value={milestoneForm.projectMilestoneId}
                onChange={(e) => setMilestoneForm({ ...milestoneForm, projectMilestoneId: e.target.value })}>
                <option value="">-- None --</option>
                {allProjectMilestones.map((ms) => (
                  <option key={ms.id} value={ms.id}>{ms.projectName} &rarr; {ms.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-slate-500 mb-1">No project milestones found for this company&apos;s projects.</p>
            )}
            <button type="button" onClick={() => setShowCreateProjectMilestone(true)}
              className="text-xs text-brand-400 hover:text-brand-300 mt-1">
              + Create a new project milestone
            </button>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowAddMilestone(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAddMilestone}
              disabled={!milestoneForm.amount || !milestoneForm.dueDate}
              className="btn-primary disabled:opacity-50">Add Milestone</button>
          </div>
        </div>
      </Modal>

      {/* Topup Modal */}
      <Modal isOpen={showTopup} onClose={() => setShowTopup(false)} title="Top Up Hours Block">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <div className="text-sm text-purple-400">Current block: <span className="font-semibold">{contract.totalHours}h</span> ({hoursRemaining?.toFixed(1)}h remaining)</div>
          </div>
          <div>
            <label className="label">Hours to Add *</label>
            <input className="input w-full" type="number" step="0.5" min="0.5" value={topupHours}
              onChange={(e) => setTopupHours(e.target.value)} placeholder="e.g. 10" />
            {topupHours && parseFloat(topupHours) > 0 && (
              <div className="text-xs text-surface-400 mt-1">
                New total: <span className="text-white font-medium">{((contract.totalHours || 0) + parseFloat(topupHours)).toFixed(1)}h</span>
                {' '}({(hoursRemaining! + parseFloat(topupHours)).toFixed(1)}h remaining)
              </div>
            )}
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input w-full" value={topupNote} onChange={(e) => setTopupNote(e.target.value)} placeholder="e.g. Q2 renewal" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowTopup(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleTopup} disabled={!topupHours || parseFloat(topupHours) <= 0}
              className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-4 py-2 rounded-lg hover:bg-purple-500/30 text-sm font-medium transition-colors disabled:opacity-50">
              Add {topupHours || '0'}h
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Project Milestone Modal */}
      {showCreateProjectMilestone && (
        <Modal title="Create Project Milestone" onClose={() => setShowCreateProjectMilestone(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Project *</label>
              {projectsData?.items?.length > 0 ? (
                <select className="w-full" value={pmForm.projectId}
                  onChange={(e) => setPmForm({ ...pmForm, projectId: e.target.value })}>
                  <option value="">Select a project</option>
                  {projectsData.items.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-amber-400">No projects found for this company. Create a project first at Projects → New Project.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Milestone Name *</label>
              <input value={pmForm.name} onChange={e => setPmForm({ ...pmForm, name: e.target.value })}
                className="w-full" placeholder="e.g. Phase 1 - Discovery" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <input value={pmForm.description} onChange={e => setPmForm({ ...pmForm, description: e.target.value })}
                className="w-full" placeholder="Optional description" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Due Date</label>
              <input type="date" value={pmForm.dueDate} onChange={e => setPmForm({ ...pmForm, dueDate: e.target.value })}
                className="w-full" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreateProjectMilestone(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreateProjectMilestone}
                disabled={!pmForm.projectId || !pmForm.name || pmSaving}
                className="btn-primary">
                {pmSaving ? 'Creating...' : 'Create Milestone'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
