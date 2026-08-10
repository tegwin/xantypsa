'use client';

import { useState, useMemo } from 'react';
import { useApi, apiPost } from '@/hooks/useApi';
import { PageHeader, DataTable, StatusBadge, Modal, Pagination, EmptyState, LoadingSpinner } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  sortOrder: number;
  productId: string | null;
}

function emptyItem(sortOrder: number): LineItem {
  return { description: '', quantity: 1, unitPrice: 0, taxRate: 20, discount: 0, sortOrder, productId: null };
}

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const { data, loading, refetch } = useApi<any>(`/api/invoices?page=${page}&search=${search}&status=${statusFilter}&limit=25`);
  const { data: companiesData } = useApi<any>('/api/companies?limit=500');

  const [form, setForm] = useState({
    companyId: '', contactId: '', contractId: '', title: '',
    paymentTerms: 'net_30', isRecurring: false, recurringFreq: 'monthly',
    nextRecurring: '', notes: '',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([emptyItem(0)]);

  // Dependent fetches
  const { data: contactsData } = useApi<any>(
    form.companyId ? `/api/contacts?companyId=${form.companyId}&limit=500` : null
  );
  const { data: contractsData } = useApi<any>(
    form.companyId ? `/api/contracts?companyId=${form.companyId}&limit=500` : null
  );
  const { data: productsData } = useApi<any>(
    showProductPicker ? `/api/products?limit=100&search=${productSearch}` : null
  );

  const statuses = ['', 'draft', 'sent', 'paid', 'overdue', 'cancelled'];

  const addItem = () => setLineItems([...lineItems, emptyItem(lineItems.length)]);
  const removeItem = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems];
    (updated[idx] as any)[field] = value;
    setLineItems(updated);
  };

  const addProductAsItem = (product: any) => {
    const newItem: LineItem = {
      description: product.name + (product.description ? ` - ${product.description}` : ''),
      quantity: 1,
      unitPrice: product.unitPrice || 0,
      taxRate: product.taxRate ?? 20,
      discount: 0,
      sortOrder: lineItems.length,
      productId: product.id,
    };
    setLineItems([...lineItems, newItem]);
    setShowProductPicker(false);
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;
    lineItems.forEach((item) => {
      const lineNet = item.quantity * item.unitPrice * (1 - item.discount / 100);
      const lineTax = lineNet * item.taxRate / 100;
      subtotal += lineNet;
      taxTotal += lineTax;
      discountTotal += item.quantity * item.unitPrice * item.discount / 100;
    });
    return { subtotal, taxTotal, discountTotal, total: subtotal + taxTotal };
  }, [lineItems]);

  const lineTotal = (item: LineItem) => {
    const lineNet = item.quantity * item.unitPrice * (1 - item.discount / 100);
    return lineNet + (lineNet * item.taxRate / 100);
  };

  const resetForm = () => {
    setForm({ companyId: '', contactId: '', contractId: '', title: '', paymentTerms: 'net_30', isRecurring: false, recurringFreq: 'monthly', nextRecurring: '', notes: '' });
    setLineItems([emptyItem(0)]);
  };

  const handleCreate = async () => {
    const res = await apiPost('/api/invoices', {
      companyId: form.companyId || null,
      contactId: form.contactId || null,
      contractId: form.contractId || null,
      title: form.title,
      paymentTerms: form.paymentTerms,
      isRecurring: form.isRecurring,
      recurringFreq: form.isRecurring ? form.recurringFreq : null,
      nextRecurring: form.isRecurring && form.nextRecurring ? new Date(form.nextRecurring).toISOString() : null,
      notes: form.notes,
      lineItems: lineItems.filter(li => li.description),
    });
    if (res) {
      setShowCreate(false);
      resetForm();
      refetch();
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Invoices" subtitle="Manage billing and payments">
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New Invoice</button>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="Search invoices..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input w-full max-w-md" />
          <div className="flex gap-2">
            {statuses.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${statusFilter === s ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>

        {loading ? <LoadingSpinner /> : !data?.items?.length ? (
          <EmptyState title="No invoices found" description="Create your first invoice" actionLabel="New Invoice" onAction={() => setShowCreate(true)} />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'invoiceNumber', label: 'Number', render: (r: any) => (
                  <Link href={`/invoices/${r.id}`} className="text-blue-400 hover:text-blue-300 font-mono">{r.invoiceNumber}</Link>
                )},
                { key: 'company', label: 'Company', render: (r: any) => <span className="text-white">{r.company?.name || '—'}</span> },
                { key: 'status', label: 'Status', render: (r: any) => (
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.isRecurring && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30">Recurring</span>
                    )}
                  </div>
                )},
                { key: 'total', label: 'Total', render: (r: any) => <span className="font-semibold text-white">{formatCurrency(r.total)}</span> },
                { key: 'paidAmount', label: 'Paid', render: (r: any) => (
                  <span className={r.amountPaid >= r.total ? 'text-green-400' : 'text-amber-400'}>{formatCurrency(r.amountPaid)}</span>
                )},
                { key: 'dueDate', label: 'Due Date', render: (r: any) => (
                  <span className={r.dueDate && new Date(r.dueDate) < new Date() && r.status !== 'paid' ? 'text-red-400' : 'text-slate-400'}>
                    {r.dueDate ? formatDate(r.dueDate) : '—'}
                  </span>
                )},
                { key: 'createdAt', label: 'Created', render: (r: any) => <span className="text-slate-400 text-sm">{formatDate(r.createdAt)}</span> },
              ]}
              data={data.items}
            />
            <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* ========== CREATE INVOICE MODAL ========== */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Invoice" size="xl">
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Header fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Title</label>
              <input className="input w-full" placeholder="Invoice title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Company *</label>
              <select className="input w-full" value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value, contactId: '', contractId: '' })}>
                <option value="">Select company</option>
                {companiesData?.items?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Contact</label>
              <select className="input w-full" value={form.contactId}
                onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                disabled={!form.companyId}>
                <option value="">Select contact</option>
                {contactsData?.items?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Contract (optional)</label>
              <select className="input w-full" value={form.contractId}
                onChange={(e) => setForm({ ...form, contractId: e.target.value })}
                disabled={!form.companyId}>
                <option value="">No contract</option>
                {contractsData?.items?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.contractNumber} - {c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Payment Terms</label>
              <select className="input w-full" value={form.paymentTerms}
                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}>
                <option value="due_on_receipt">Due on Receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_60">Net 60</option>
              </select>
            </div>
          </div>

          {/* Recurring Invoice Toggle */}
          <div className="glass rounded-xl p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.isRecurring}
                onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600" />
              <span className="text-white font-medium">Recurring Invoice</span>
            </label>
            {form.isRecurring && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="label">Frequency</label>
                  <select className="input w-full" value={form.recurringFreq}
                    onChange={(e) => setForm({ ...form, recurringFreq: e.target.value })}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                  </select>
                </div>
                <div>
                  <label className="label">Next Invoice Date</label>
                  <input className="input w-full" type="date" value={form.nextRecurring}
                    onChange={(e) => setForm({ ...form, nextRecurring: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Line Items</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowProductPicker(true)} className="btn-secondary text-sm">+ From Products</button>
                <button onClick={addItem} className="btn-primary text-sm">+ Add Item</button>
              </div>
            </div>

            {/* Table header */}
            <div className="hidden md:grid grid-cols-12 gap-2 mb-2 text-xs text-slate-400 font-medium px-1">
              <div className="col-span-3">Description</div>
              <div className="col-span-1 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-2 text-right">Tax %</div>
              <div className="col-span-1 text-right">Disc %</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            <div className="space-y-2">
              {lineItems.map((li, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input className="input col-span-12 md:col-span-3" placeholder="Description" value={li.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                  <input className="input col-span-3 md:col-span-1 text-right" type="number" min="0" step="0.01" placeholder="Qty" value={li.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                  <input className="input col-span-4 md:col-span-2 text-right" type="number" step="0.01" placeholder="Price" value={li.unitPrice}
                    onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                  <input className="input col-span-2 md:col-span-2 text-right" type="number" step="0.01" placeholder="Tax%" value={li.taxRate}
                    onChange={(e) => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)} />
                  <input className="input col-span-2 md:col-span-1 text-right" type="number" step="0.01" placeholder="Disc%" value={li.discount}
                    onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)} />
                  <div className="col-span-3 md:col-span-2 text-right text-white font-medium text-sm pr-2">
                    {formatCurrency(lineTotal(li))}
                  </div>
                  <div className="col-span-1 text-center">
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300 text-lg">x</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.discountTotal > 0 && (
                    <div className="flex justify-between text-slate-400">
                      <span>Discount</span><span>-{formatCurrency(totals.discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>Tax</span><span>{formatCurrency(totals.taxTotal)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-base border-t border-white/10 pt-2">
                    <span>Total</span><span>{formatCurrency(totals.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea className="input w-full" rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button onClick={() => { setShowCreate(false); resetForm(); }} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate}
              disabled={!form.companyId || !lineItems.some(li => li.description)}
              className="btn-primary">
              Create Invoice
            </button>
          </div>
        </div>
      </Modal>

      {/* ========== PRODUCT PICKER MODAL ========== */}
      <Modal isOpen={showProductPicker} onClose={() => setShowProductPicker(false)} title="Add Product">
        <div className="space-y-4">
          <input className="input w-full" placeholder="Search products..."
            value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {productsData?.items?.length ? (
              productsData.items.map((p: any) => (
                <button key={p.id} onClick={() => addProductAsItem(p)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{p.name}</div>
                    <div className="text-slate-400 text-xs">
                      {p.sku ? `${p.sku} - ` : ''}{p.type} {p.billingType === 'recurring' ? `(${p.billingPeriod || 'recurring'})` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-medium">{formatCurrency(p.unitPrice)}</div>
                    <div className="text-slate-400 text-xs">{p.taxRate}% tax</div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-slate-400 text-center py-8">No products found</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
