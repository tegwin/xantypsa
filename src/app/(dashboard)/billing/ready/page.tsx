'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader, Button, Badge, Modal, Input, LoadingSpinner } from '@/components/ui';
import { DollarSign, Clock, Building2, FileText, ChevronDown, ChevronRight, Check, Moon } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface TimeEntry {
  id: string; date: string; minutes: number; hours: number; rate: number; billedAmount: number; isOOH: boolean;
  description: string;
  user: { id: string; name: string };
  ticket: { id: string; ticketNumber: number; title: string; status: string; company: { id: string; name: string } | null } | null;
  billingRate: { id: string; name: string; code: string } | null;
}

interface CompanyGroup {
  company: { id: string | null; name: string };
  entries: TimeEntry[];
  total: number;
  totalMinutes: number;
}

export default function ReadyForInvoicingPage() {
  const router = useRouter();
  const [data, setData] = useState<{ billingMode: string; groups: CompanyGroup[]; totalEntries: number; grandTotal: number; uninvoicedContracts?: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, Set<string>>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Invoice creation modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceCompany, setInvoiceCompany] = useState<{ id: string | null; name: string } | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({ title: '', notes: '', dueInDays: '30' });
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    const res = await fetch('/api/billing/ready');
    const json = await res.json();
    setData(json);
    // Auto-expand all groups
    setExpandedGroups(new Set(json.groups?.map((g: CompanyGroup) => g.company.id || 'no_company') || []));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggleGroup = (companyId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(companyId) ? next.delete(companyId) : next.add(companyId);
      return next;
    });
  };

  const toggleEntry = (companyId: string, entryId: string) => {
    setSelectedEntries(prev => {
      const next = { ...prev };
      if (!next[companyId]) next[companyId] = new Set();
      const s = new Set(next[companyId]);
      s.has(entryId) ? s.delete(entryId) : s.add(entryId);
      next[companyId] = s;
      return next;
    });
  };

  const toggleAllInGroup = (companyId: string, entries: TimeEntry[]) => {
    setSelectedEntries(prev => {
      const next = { ...prev };
      const current = next[companyId] || new Set();
      if (current.size === entries.length) {
        next[companyId] = new Set();
      } else {
        next[companyId] = new Set(entries.map(e => e.id));
      }
      return next;
    });
  };

  const getSelectedTotal = (companyId: string, entries: TimeEntry[]) => {
    const sel = selectedEntries[companyId] || new Set();
    return entries.filter(e => sel.has(e.id)).reduce((sum, e) => sum + (e.billedAmount || 0), 0);
  };

  const getSelectedCount = (companyId: string) => (selectedEntries[companyId] || new Set()).size;

  const openCreateInvoice = (group: CompanyGroup) => {
    const companyId = group.company.id || 'no_company';
    const sel = selectedEntries[companyId] || new Set();
    if (sel.size === 0) {
      toast.error('Select time entries to invoice');
      return;
    }
    setInvoiceCompany(group.company);
    const monthName = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    setInvoiceForm({ title: `Time & Materials - ${monthName}`, notes: '', dueInDays: '30' });
    setShowInvoiceModal(true);
  };

  const createInvoice = async () => {
    const companyId = invoiceCompany?.id || 'no_company';
    const entryIds = Array.from(selectedEntries[companyId] || []);
    if (entryIds.length === 0) return;

    setCreating(true);
    try {
      const res = await fetch('/api/billing/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryIds,
          companyId: invoiceCompany?.id || null,
          title: invoiceForm.title,
          notes: invoiceForm.notes,
          dueInDays: parseInt(invoiceForm.dueInDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Invoice ${data.invoiceNumber} created!`);
      setShowInvoiceModal(false);
      setSelectedEntries(prev => ({ ...prev, [companyId]: new Set() }));
      fetchData(); // Refresh
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const invoiceContract = async (contract: any) => {
    if (!confirm(`Create invoice for ${contract.name} - ${formatCurrency(contract.value || 0)}?`)) return;
    try {
      const typeLabels: Record<string, string> = { prepay_hours: 'Pre-Pay Hours Block', fixed_price: 'Fixed Price', managed_service: 'Monthly Service' };
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: contract.company?.id,
          contractId: contract.id,
          title: `${contract.name}`,
          lineItems: [{
            description: `${typeLabels[contract.type] || contract.type} - ${contract.name}${contract.totalHours ? ` (${contract.totalHours}h block)` : ''}`,
            quantity: 1,
            unitPrice: contract.value || 0,
            taxRate: 20,
          }],
        }),
      });
      const inv = await res.json();
      if (!res.ok) throw new Error(inv.error || 'Failed');
      toast.success(`Invoice ${inv.invoiceNumber} created!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner />;

  const totalSelected = Object.values(selectedEntries).reduce((sum, s) => sum + s.size, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Ready for Invoicing" subtitle={
        data ? `${data.totalEntries} unbilled entries · ${formatCurrency(data.grandTotal)} total` +
          (data.uninvoicedContracts?.length ? ` · ${data.uninvoicedContracts.length} contract${data.uninvoicedContracts.length > 1 ? 's' : ''} to bill` : '') +
          (data.billingMode === 'on_close' ? ' (billing on ticket close)' : '') : ''
      } />

      {totalSelected > 0 && (
        <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-brand-400">{totalSelected} entries selected</span>
        </div>
      )}

      {/* Uninvoiced Contracts */}
      {data?.uninvoicedContracts && data.uninvoicedContracts.length > 0 && (
        <div className="glass-panel p-6">
          <h3 className="text-white font-semibold mb-1">Contracts to Invoice</h3>
          <p className="text-xs text-surface-500 mb-4">Active contracts that haven't been invoiced yet</p>
          <div className="space-y-2">
            {data.uninvoicedContracts.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    c.type === 'prepay_hours' ? 'bg-purple-500/20 text-purple-400' :
                    c.type === 'fixed_price' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {c.type === 'prepay_hours' ? 'Block' : c.type === 'fixed_price' ? 'Fixed' : 'Monthly'}
                  </span>
                  <div>
                    <span className="text-white text-sm font-medium">{c.name}</span>
                    <span className="text-surface-500 text-xs ml-2">{c.company?.name}</span>
                    {c.totalHours && <span className="text-surface-500 text-xs ml-1">({c.totalHours}h)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold">{formatCurrency(c.value || 0)}</span>
                  <button onClick={() => invoiceContract(c)}
                    className="text-xs bg-brand-500/20 text-brand-400 border border-brand-500/30 px-3 py-1.5 rounded-lg hover:bg-brand-500/30 transition-colors font-medium">
                    Create Invoice
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data?.groups?.length === 0 && (!data?.uninvoicedContracts || data.uninvoicedContracts.length === 0) ? (
        <div className="glass-panel p-12 text-center">
          <DollarSign className="h-12 w-12 text-surface-600 mx-auto mb-3" />
          <h3 className="text-lg text-surface-300 mb-1">Nothing to invoice</h3>
          <p className="text-sm text-surface-500">
            {data.billingMode === 'on_close'
              ? 'No unbilled time entries on closed tickets. Close tickets to make entries available.'
              : 'No unbilled time entries found. Log time on tickets to see entries here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.groups?.map(group => {
            const companyId = group.company.id || 'no_company';
            const isExpanded = expandedGroups.has(companyId);
            const selectedCount = getSelectedCount(companyId);
            const selectedTotal = getSelectedTotal(companyId, group.entries);
            const allSelected = selectedCount === group.entries.length;

            return (
              <div key={companyId} className="glass-panel overflow-hidden">
                {/* Company header */}
                <div className="flex items-center gap-3 px-5 py-3 bg-surface-800/80 border-b border-surface-700/50 cursor-pointer"
                  onClick={() => toggleGroup(companyId)}>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
                  <Building2 className="h-4 w-4 text-surface-400" />
                  <span className="font-medium text-surface-100 flex-1">{group.company.name}</span>
                  <span className="text-xs text-surface-400">{group.entries.length} entries · {Math.round(group.totalMinutes / 60 * 10) / 10}h</span>
                  <span className="font-medium text-surface-100">{formatCurrency(group.total)}</span>
                  {selectedCount > 0 && (
                    <Button size="sm" onClick={(e: any) => { e.stopPropagation(); openCreateInvoice(group); }}>
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      Invoice {selectedCount} ({formatCurrency(selectedTotal)})
                    </Button>
                  )}
                </div>

                {/* Entries */}
                {isExpanded && (
                  <div>
                    {/* Select all */}
                    <div className="flex items-center gap-3 px-5 py-2 bg-surface-800/40 border-b border-surface-700/30 text-xs text-surface-400">
                      <input type="checkbox" checked={allSelected} onChange={() => toggleAllInGroup(companyId, group.entries)} />
                      <span className="flex-1">Select all</span>
                      <span className="w-24">Ticket</span>
                      <span className="w-24">Rate</span>
                      <span className="w-16 text-right">Time</span>
                      <span className="w-20 text-right">Amount</span>
                    </div>

                    {group.entries.map(entry => {
                      const isSelected = (selectedEntries[companyId] || new Set()).has(entry.id);
                      return (
                        <div key={entry.id}
                          className={`flex items-center gap-3 px-5 py-2.5 border-b border-surface-700/20 hover:bg-surface-800/30 transition-colors ${isSelected ? 'bg-brand-500/5' : ''}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleEntry(companyId, entry.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-surface-200 truncate">{entry.description || ' - '}</p>
                            <p className="text-xs text-surface-500">{entry.user.name} · {formatDate(entry.date)}</p>
                          </div>
                          <span className="w-24 text-xs">
                            {entry.ticket ? (
                              <span className="text-brand-400 cursor-pointer hover:underline" onClick={() => router.push(`/service-desk/tickets/${entry.ticket!.id}`)}>
                                #{entry.ticket.ticketNumber}
                              </span>
                            ) : ' - '}
                          </span>
                          <span className="w-24 text-xs text-surface-400">
                            {entry.billingRate?.name || ' - '}
                            {entry.isOOH && <Moon className="h-3 w-3 text-amber-400 inline ml-1" />}
                          </span>
                          <span className="w-16 text-right text-xs text-surface-300">{entry.minutes}m</span>
                          <span className="w-20 text-right text-sm font-medium text-surface-100">
                            {formatCurrency(entry.billedAmount || 0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Invoice Modal */}
      <Modal open={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title={`Create Invoice - ${invoiceCompany?.name}`}
        footer={<><Button variant="secondary" onClick={() => setShowInvoiceModal(false)}>Cancel</Button><Button loading={creating} onClick={createInvoice}>Create Invoice</Button></>}>
        <div className="space-y-4">
          <div className="bg-surface-800/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-surface-400">Selected entries:</span>
              <span className="text-surface-200">{(selectedEntries[invoiceCompany?.id || 'no_company'] || new Set()).size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Total amount:</span>
              <span className="text-white font-medium">
                {formatCurrency(getSelectedTotal(
                  invoiceCompany?.id || 'no_company',
                  data?.groups?.find(g => (g.company.id || 'no_company') === (invoiceCompany?.id || 'no_company'))?.entries || []
                ))}
              </span>
            </div>
            <p className="text-xs text-surface-500 mt-2">Line items will be grouped by billing rate name (e.g. "Standard - 3.5h", "Premium - 1h") with ticket references.</p>
          </div>
          <Input label="Invoice Title" value={invoiceForm.title}
            onChange={e => setInvoiceForm(p => ({ ...p, title: e.target.value }))} />
          <Input label="Due In (days)" type="number" value={invoiceForm.dueInDays}
            onChange={e => setInvoiceForm(p => ({ ...p, dueInDays: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">Notes</label>
            <textarea rows={3} value={invoiceForm.notes} onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes to include on the invoice" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
