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

/**
 * One kind of work waiting to be invoiced.
 *
 * The count is in the heading and an empty panel still renders, so a category
 * with nothing in it is visibly empty rather than absent.
 */
function Panel({ title, count, description, children }: {
  title: string; count: number; description: string; children?: React.ReactNode;
}) {
  return (
    <div className="glass-panel p-6">
      <h3 className="text-white font-semibold mb-1">{title} ({count})</h3>
      <p className="text-xs text-surface-500 mb-4">{description}</p>
      {count === 0
        ? <p className="py-8 text-center text-sm text-surface-500">No invoices to create</p>
        : <div className="space-y-2">{children}</div>}
    </div>
  );
}

/** A single billable line inside a panel. */
function Row({ title, meta, amount, actionLabel, onAction }: {
  title: string; meta?: string; amount: number; actionLabel: string; onAction: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{title}</p>
        {meta && <p className="text-surface-500 text-xs truncate">{meta}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-white font-semibold">{formatCurrency(amount)}</span>
        <button onClick={onAction}
          className="text-xs bg-brand-500/20 text-brand-400 border border-brand-500/30 px-3 py-1.5 rounded-lg hover:bg-brand-500/30 transition-colors font-medium">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export default function ReadyForInvoicingPage() {
  const router = useRouter();
  const [data, setData] = useState<{
    billingMode: string; groups: CompanyGroup[]; totalEntries: number; grandTotal: number;
    uninvoicedContracts?: any[];
    quotes?: any[]; quoteTotal?: number;
    projects?: any[]; projectTotal?: number;
  } | null>(null);
  // Which kind of work is on screen. Billing a block is a different job from
  // billing labour, so they are not mixed into one list.
  const [section, setSection] = useState<'all' | 'labour' | 'quotes' | 'prepay' | 'products' | 'projects'>('all');
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

      // A pre-pay contract bills its blocks: the hours bought, at the rate they
      // were bought at. The labour logged against it is already paid for by
      // those hours and is never billed again.
      const blocks = contract.hourBlocks || [];
      const lineItems = contract.type === 'prepay_hours' && blocks.length > 0
        ? blocks.map((b: any) => ({
            // Spell the sum out on the line itself, so the invoice reads the
            // way the block was sold: 10 hours at £250.00 per hour.
            description: `Pre-pay block${b.source === 'top_up' ? ' top-up' : ''}${
              b.periodStart ? ` - ${new Date(b.periodStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}` : ''
            } - ${b.hours} hours at ${formatCurrency(b.hourlyRate || 0)} per hour`,
            quantity: b.hours,
            unitPrice: b.hourlyRate || 0,
            taxRate: 20,
          }))
        : [{
            description: `${typeLabels[contract.type] || contract.type} - ${contract.name}${contract.totalHours ? ` (${contract.totalHours}h block)` : ''}`,
            quantity: 1,
            unitPrice: contract.value || 0,
            taxRate: 20,
          }];

      // The work the block paid for, shown at zero so the customer sees what
      // their hours went on without being charged for it twice.
      const covered = contract.type === 'prepay_hours' ? (contract.coveredTime || []) : [];
      for (const t of covered) {
        lineItems.push({
          description: `${t.ticketNumber ? `#${t.ticketNumber} ${t.ticketTitle} - ` : ''}${
            t.hours
          }h on ${new Date(t.date).toLocaleDateString('en-GB')} - deducted from pre-pay`,
          quantity: t.hours,
          unitPrice: 0,
          taxRate: 0,
        });
      }

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: contract.company?.id,
          contractId: contract.id,
          title: `${contract.name}`,
          lineItems,
        }),
      });
      const inv = await res.json();
      if (!res.ok) throw new Error(inv.error || 'Failed');

      // Mark the blocks billed so the same hours are never invoiced twice.
      if (contract.type === 'prepay_hours' && blocks.length > 0) {
        await fetch(`/api/contracts/${contract.id}/hour-blocks`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blockIds: blocks.map((b: any) => b.id), invoiceId: inv.id }),
        });
      }

      toast.success(`Invoice ${inv.invoiceNumber} created!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner />;

  const totalSelected = Object.values(selectedEntries).reduce((sum, s) => sum + s.size, 0);

  // A pre-pay block and a monthly or fixed fee are both "contracts to bill" in
  // the API, but they are different money to the person doing the billing.
  const blockContracts = (data?.uninvoicedContracts ?? []).filter((c: any) => c.type === 'prepay_hours');
  const productContracts = (data?.uninvoicedContracts ?? []).filter((c: any) => c.type !== 'prepay_hours');
  const sum = (rows: any[], field = 'value') => rows.reduce((t, r) => t + (r[field] || 0), 0);

  const SECTIONS = [
    { key: 'all' as const, label: 'All', count: 0, total: 0 },
    { key: 'quotes' as const, label: 'Quotes', count: data?.quotes?.length ?? 0, total: data?.quoteTotal ?? 0 },
    { key: 'labour' as const, label: 'Labour', count: data?.totalEntries ?? 0, total: data?.grandTotal ?? 0 },
    { key: 'prepay' as const, label: 'Prepay blocks', count: blockContracts.length, total: sum(blockContracts) },
    { key: 'products' as const, label: 'Products & services', count: productContracts.length, total: sum(productContracts) },
    { key: 'projects' as const, label: 'Projects', count: data?.projects?.length ?? 0, total: data?.projectTotal ?? 0 },
  ];
  // "All" carries the combined figure, so the top row always adds up.
  SECTIONS[0].count = SECTIONS.slice(1).reduce((t, s) => t + s.count, 0);
  SECTIONS[0].total = SECTIONS.slice(1).reduce((t, s) => t + s.total, 0);

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

      {/* Where the money comes from. Every section is shown with its total, so
          nothing is missed by sitting behind a tab nobody opened. */}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {SECTIONS.map(sec => (
          <button
            key={sec.key}
            onClick={() => setSection(sec.key)}
            aria-current={sec.key === section ? 'true' : undefined}
            className={`rounded-lg border p-4 text-left transition-colors ${
              sec.key === section
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-surface-700 bg-surface-800/40 hover:border-surface-600'
            }`}
          >
            <p className="text-sm text-surface-400">{sec.label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(sec.total)}</p>
            <p className="text-xs text-surface-500">{sec.count} {sec.count === 1 ? 'item' : 'items'}</p>
          </button>
        ))}
      </div>

      {/* Halo lays these out as one panel per kind of work, each showing its
          count even when empty, so nothing is hidden behind an unopened tab.
          "All" shows the lot; picking a kind gives it the full width. */}
      <div className={section === 'all' ? 'grid gap-4 xl:grid-cols-2 items-start' : 'space-y-6'}>

        {(section === 'all' || section === 'quotes') && (
          <Panel title="Quotes" count={data?.quotes?.length ?? 0}
            description="Accepted by the customer, not yet turned into an invoice">
            {data?.quotes?.map((q: any) => (
              <Row key={q.id}
                title={q.title || 'Quote'}
                meta={[q.quoteNumber, q.company?.name].filter(Boolean).join(' · ')}
                amount={q.total || 0}
                actionLabel="Convert to Invoice"
                onAction={() => router.push(`/quotes/${q.id}`)}
              />
            ))}
          </Panel>
        )}

        {(section === 'all' || section === 'prepay') && (
          <Panel title="Prepay Blocks" count={blockContracts.length}
            description="Blocks of hours sold but never invoiced. A block is billed when it is bought, not as it is used.">
            {blockContracts.map((c: any) => (
              <Row key={c.id}
                title={c.name}
                meta={[c.company?.name, c.totalHours ? `${c.totalHours}h` : null].filter(Boolean).join(' · ')}
                amount={c.value || 0}
                actionLabel="Create Invoice"
                onAction={() => invoiceContract(c)}
              />
            ))}
          </Panel>
        )}

        {(section === 'all' || section === 'products') && (
          <Panel title="Products & Services" count={productContracts.length}
            description="Monthly and fixed-price contracts that have not been invoiced yet">
            {productContracts.map((c: any) => (
              <Row key={c.id}
                title={c.name}
                meta={[c.company?.name, c.type === 'fixed_price' ? 'Fixed' : 'Monthly'].filter(Boolean).join(' · ')}
                amount={c.value || 0}
                actionLabel="Create Invoice"
                onAction={() => invoiceContract(c)}
              />
            ))}
          </Panel>
        )}

        {(section === 'all' || section === 'projects') && (
          <Panel title="Projects" count={data?.projects?.length ?? 0}
            description="Completed fixed-price projects. Nothing links an invoice back to a project yet, so these stay listed once billed - a reminder, not a ledger.">
            {data?.projects?.map((p: any) => (
              <Row key={p.id}
                title={p.name}
                meta={[p.company?.name, p.endDate ? formatDate(p.endDate) : null].filter(Boolean).join(' · ')}
                amount={p.value || 0}
                actionLabel="Open project"
                onAction={() => router.push(`/projects/${p.id}`)}
              />
            ))}
          </Panel>
        )}


        {/* Labour keeps its own layout: it carries the per-entry checkboxes
            and the create-invoice flow, so it spans both columns. */}
        {(section === 'all' || section === 'labour') && (
          <div className={section === 'all' ? 'xl:col-span-2' : ''}>
            <h3 className="text-white font-semibold mb-1">Labour ({data?.totalEntries ?? 0})</h3>
            <p className="text-xs text-surface-500 mb-3">
              Billable time charged time and materials. Time covered by a contract is not here, because the contract bills it.
            </p>
      {data?.groups?.length === 0 ? (
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
          </div>
        )}
      </div>

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
