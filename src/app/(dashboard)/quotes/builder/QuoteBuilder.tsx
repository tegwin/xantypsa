'use client';

import { useState, useMemo } from 'react';
import { useApi, apiPost, apiPatch } from '@/hooks/useApi';
import { PageHeader, Modal, LoadingSpinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  isOptional: boolean;
  section: string;
  sortOrder: number;
  productId: string | null;
  billingType: string;
  billingPeriod: string;
  costPrice: number | null;
}

function emptyItem(sortOrder: number): LineItem {
  return {
    description: '', quantity: 1, unitPrice: 0, taxRate: 20, discount: 0,
    isOptional: false, section: '', sortOrder, productId: null,
    billingType: 'one_off', billingPeriod: '', costPrice: null,
  };
}

interface QuoteBuilderProps {
  initialData?: any;
}

export default function QuoteBuilder({ initialData }: QuoteBuilderProps) {
  const router = useRouter();
  const isEdit = !!initialData?.id;

  const [title, setTitle] = useState(initialData?.title || '');
  const [companyId, setCompanyId] = useState(initialData?.companyId || '');
  const [contactId, setContactId] = useState(initialData?.contactId || '');
  const [currency, setCurrency] = useState(initialData?.currency || 'GBP');
  const [validUntil, setValidUntil] = useState(initialData?.validUntil?.split('T')[0] || '');
  const [discount, setDiscount] = useState<number>(initialData?.discount || 0);
  const [discountType, setDiscountType] = useState(initialData?.discountType || 'percentage');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [terms, setTerms] = useState(initialData?.terms || '');
  const [internalNotes, setInternalNotes] = useState(initialData?.internalNotes || '');
  const [items, setItems] = useState<LineItem[]>(
    initialData?.items?.length
      ? initialData.items.map((it: any, i: number) => ({
          description: it.description || '',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          taxRate: it.taxRate ?? 20,
          discount: it.discount || 0,
          isOptional: it.isOptional || false,
          section: it.section || '',
          sortOrder: it.sortOrder ?? i,
          productId: it.productId || null,
          billingType: it.billingType || 'one_off',
          billingPeriod: it.billingPeriod || '',
          costPrice: it.costPrice ?? null,
        }))
      : [emptyItem(0)]
  );
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: companiesData } = useApi<any>('/api/companies?limit=500');
  const { data: contactsData } = useApi<any>(companyId ? `/api/contacts?companyId=${companyId}&limit=500` : '/api/contacts?limit=500');
  const { data: productsData } = useApi<any>(`/api/products?limit=100&search=${productSearch}`);

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    items.forEach((item) => {
      if (item.isOptional) return;
      const lineNet = item.quantity * item.unitPrice - (item.quantity * item.unitPrice * item.discount / 100);
      const lineTax = lineNet * item.taxRate / 100;
      subtotal += lineNet;
      taxTotal += lineTax;
    });
    const discountAmount = discountType === 'percentage'
      ? subtotal * discount / 100
      : discount;
    const grandTotal = subtotal + taxTotal - discountAmount;
    return { subtotal, taxTotal, discountAmount, grandTotal };
  }, [items, discount, discountType]);

  const addItem = () => setItems([...items, emptyItem(items.length)]);

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const addProductAsItem = (product: any) => {
    const newItem: LineItem = {
      description: product.name + (product.description ? ` - ${product.description}` : ''),
      quantity: 1,
      unitPrice: product.unitPrice || 0,
      taxRate: product.taxRate ?? 20,
      discount: 0,
      isOptional: false,
      section: '',
      sortOrder: items.length,
      productId: product.id,
      billingType: product.billingType || 'one_off',
      billingPeriod: product.billingPeriod || '',
      costPrice: product.cost ?? null,
    };
    setItems([...items, newItem]);
    setShowProductPicker(false);
  };

  const lineTotal = (item: LineItem) => {
    const lineNet = item.quantity * item.unitPrice - (item.quantity * item.unitPrice * item.discount / 100);
    return lineNet + (lineNet * item.taxRate / 100);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title,
        companyId: companyId || null,
        contactId: contactId || null,
        currency,
        validUntil: validUntil || null,
        discount,
        discountType,
        notes,
        terms,
        internalNotes,
        items: items.map((it, i) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          discount: it.discount,
          isOptional: it.isOptional,
          section: it.section || null,
          sortOrder: i,
          productId: it.productId || null,
          billingType: it.billingType,
          billingPeriod: it.billingPeriod || null,
          costPrice: it.costPrice,
        })),
      };

      let result;
      if (isEdit) {
        result = await apiPatch(`/api/quotes/${initialData.id}`, payload);
      } else {
        result = await apiPost('/api/quotes', payload);
      }
      if (result?.id) {
        router.push(`/quotes/${result.id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title={isEdit ? 'Edit Quote' : 'New Quote'} subtitle="Build your quote line by line">
        <div className="flex gap-3">
          <button onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !title.trim()} className="btn-primary">
            {saving ? 'Saving...' : isEdit ? 'Update Quote' : 'Create Quote'}
          </button>
        </div>
      </PageHeader>

      {/* Header fields */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="label">Title *</label>
            <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quote title" />
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input w-full" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="label">Company</label>
            <select className="input w-full" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setContactId(''); }}>
              <option value="">-- Select company --</option>
              {companiesData?.items?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Contact</label>
            <select className="input w-full" value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">-- Select contact --</option>
              {contactsData?.items?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Valid Until</label>
            <input className="input w-full" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Line Items</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowProductPicker(true)} className="btn-secondary text-sm">
              + From Product
            </button>
            <button onClick={addItem} className="btn-primary text-sm">+ Add Line</button>
          </div>
        </div>

        {/* Table header */}
        <div className="hidden md:grid grid-cols-12 gap-2 mb-2 text-xs text-slate-400 font-medium px-1">
          <div className="col-span-3">Description</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-2 text-right">Unit Price</div>
          <div className="col-span-1 text-right">Tax %</div>
          <div className="col-span-1 text-right">Disc %</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-1 text-center">Opt</div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className={`grid grid-cols-12 gap-2 items-center ${item.isOptional ? 'opacity-60' : ''}`}>
              <input
                className="input col-span-12 md:col-span-3"
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(idx, 'description', e.target.value)}
              />
              <input
                className="input col-span-3 md:col-span-1 text-right"
                type="number"
                min="0"
                step="0.01"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
              />
              <input
                className="input col-span-4 md:col-span-2 text-right"
                type="number"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
              />
              <input
                className="input col-span-2 md:col-span-1 text-right"
                type="number"
                step="0.01"
                value={item.taxRate}
                onChange={(e) => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
              />
              <input
                className="input col-span-2 md:col-span-1 text-right"
                type="number"
                step="0.01"
                value={item.discount}
                onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)}
              />
              <div className="col-span-3 md:col-span-2 text-right text-white font-medium text-sm pr-2">
                {formatCurrency(lineTotal(item))}
              </div>
              <div className="col-span-1 text-center">
                <input
                  type="checkbox"
                  checked={item.isOptional}
                  onChange={(e) => updateItem(idx, 'isOptional', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600"
                  title="Optional item"
                />
              </div>
              <div className="col-span-1 text-center">
                <button
                  onClick={() => removeItem(idx)}
                  className="text-red-400 hover:text-red-300 text-lg"
                  title="Remove item"
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between text-slate-400 text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-sm">
                <span>Tax</span>
                <span>{formatCurrency(totals.taxTotal)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-sm gap-2">
                <span>Discount</span>
                <div className="flex items-center gap-1">
                  <input
                    className="input w-20 text-right text-sm"
                    type="number"
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  />
                  <select
                    className="input w-20 text-sm"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                  >
                    <option value="percentage">%</option>
                    <option value="fixed">Fixed</option>
                  </select>
                  <span className="ml-2 w-24 text-right">-{formatCurrency(totals.discountAmount)}</span>
                </div>
              </div>
              <div className="flex justify-between text-white font-bold text-lg border-t border-white/10 pt-2">
                <span>Total</span>
                <span>{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes & Terms */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label">Notes (visible to client)</label>
            <textarea className="input w-full" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
          </div>
          <div>
            <label className="label">Terms & Conditions</label>
            <textarea className="input w-full" rows={4} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Payment terms..." />
          </div>
          <div>
            <label className="label">Internal Notes (not visible to client)</label>
            <textarea className="input w-full" rows={4} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="Internal notes..." />
          </div>
        </div>
      </div>

      {/* Product Picker Modal */}
      <Modal isOpen={showProductPicker} onClose={() => setShowProductPicker(false)} title="Add Product">
        <div className="space-y-4">
          <input
            className="input w-full"
            placeholder="Search products..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {productsData?.items?.length ? (
              productsData.items.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => addProductAsItem(p)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors flex items-center justify-between"
                >
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
