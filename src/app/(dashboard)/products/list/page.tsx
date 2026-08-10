'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/useApi';
import { PageHeader, DataTable, StatusBadge, Modal, EmptyState, LoadingSpinner, Pagination } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

const emptyForm = {
  name: '', description: '', sku: '', category: '', type: 'service',
  unitPrice: '', cost: '', taxRate: '20', unit: 'each',
  billingType: 'one_off', billingPeriod: '', isService: false, isBundle: false, isActive: true,
};

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { data, loading, refetch } = useApi<any>(`/api/products?page=${page}&search=${search}&limit=25`);

  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (product: any) => {
    setEditingId(product.id);
    setForm({
      name: product.name || '',
      description: product.description || '',
      sku: product.sku || '',
      category: product.category || '',
      type: product.type || 'service',
      unitPrice: String(product.unitPrice ?? ''),
      cost: String(product.cost ?? ''),
      taxRate: String(product.taxRate ?? '20'),
      unit: product.unit || 'each',
      billingType: product.billingType || 'one_off',
      billingPeriod: product.billingPeriod || '',
      isService: product.isService || false,
      isBundle: product.isBundle || false,
      isActive: product.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      sku: form.sku || null,
      category: form.category || null,
      type: form.type,
      unitPrice: parseFloat(form.unitPrice) || 0,
      cost: parseFloat(form.cost) || 0,
      taxRate: parseFloat(form.taxRate) || 0,
      unit: form.unit,
      billingType: form.billingType,
      billingPeriod: form.billingType === 'recurring' ? (form.billingPeriod || null) : null,
      isService: form.isService,
      isBundle: form.isBundle,
      isActive: form.isActive,
    };

    let res;
    if (editingId) {
      res = await apiPatch(`/api/products/${editingId}`, payload);
    } else {
      res = await apiPost('/api/products', payload);
    }
    if (res) {
      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await apiDelete(`/api/products/${id}`);
    if (res) {
      setDeleteConfirm(null);
      refetch();
    }
  };

  const set = (field: string, value: any) => setForm({ ...form, [field]: value });

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Products & Services" subtitle="Manage your product catalogue">
        <button onClick={openCreate} className="btn-primary">+ Add Product</button>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        <div className="mb-4">
          <input type="text" placeholder="Search products..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input w-full max-w-md" />
        </div>

        {loading ? <LoadingSpinner /> : !data?.items?.length ? (
          <EmptyState title="No products" description="Add your first product or service" actionLabel="Add Product" onAction={openCreate} />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'name', label: 'Name', render: (r: any) => <span className="text-white font-medium">{r.name}</span> },
                { key: 'sku', label: 'SKU', render: (r: any) => <span className="text-slate-400 font-mono text-xs">{r.sku || '\u2014'}</span> },
                { key: 'type', label: 'Type', render: (r: any) => <span className="capitalize text-slate-300">{r.type}</span> },
                { key: 'unitPrice', label: 'Price', render: (r: any) => <span className="text-white">{formatCurrency(r.unitPrice)}</span> },
                { key: 'cost', label: 'Cost', render: (r: any) => <span className="text-slate-400">{r.cost ? formatCurrency(r.cost) : '\u2014'}</span> },
                { key: 'taxRate', label: 'Tax', render: (r: any) => <span className="text-slate-400">{r.taxRate}%</span> },
                { key: 'billingType', label: 'Billing', render: (r: any) => (
                  <span className="text-slate-300 text-xs">
                    {r.billingType === 'recurring' ? `Recurring (${r.billingPeriod || 'N/A'})` : 'One-off'}
                  </span>
                )},
                { key: 'isActive', label: 'Status', render: (r: any) => <StatusBadge status={r.isActive ? 'active' : 'inactive'} /> },
                { key: 'actions', label: '', render: (r: any) => (
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => openEdit(r)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                    <button onClick={() => setDeleteConfirm(r.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                  </div>
                )},
              ]}
              data={data.items}
            />
            <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Product' : 'New Product / Service'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Name *</label>
              <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label">Description</label>
              <textarea className="input w-full" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div>
              <label className="label">SKU</label>
              <input className="input w-full" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
            </div>
            <div>
              <label className="label">Category</label>
              <input className="input w-full" value={form.category} onChange={(e) => set('category', e.target.value)} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input w-full" value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="service">Service</option>
                <option value="product">Product</option>
                <option value="license">License</option>
                <option value="subscription">Subscription</option>
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <input className="input w-full" value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="each, hour, month..." />
            </div>
            <div>
              <label className="label">Unit Price *</label>
              <input className="input w-full" type="number" step="0.01" value={form.unitPrice} onChange={(e) => set('unitPrice', e.target.value)} />
            </div>
            <div>
              <label className="label">Cost Price</label>
              <input className="input w-full" type="number" step="0.01" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
            </div>
            <div>
              <label className="label">Tax Rate (%)</label>
              <input className="input w-full" type="number" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
            </div>
            <div>
              <label className="label">Billing Type</label>
              <select className="input w-full" value={form.billingType} onChange={(e) => set('billingType', e.target.value)}>
                <option value="one_off">One-off</option>
                <option value="recurring">Recurring</option>
              </select>
            </div>
            {form.billingType === 'recurring' && (
              <div>
                <label className="label">Billing Period</label>
                <select className="input w-full" value={form.billingPeriod} onChange={(e) => set('billingPeriod', e.target.value)}>
                  <option value="">-- Select --</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            )}
            <div className="col-span-2 flex gap-6 items-center pt-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.isService} onChange={(e) => set('isService', e.target.checked)} className="w-4 h-4 rounded border-slate-600" />
                Is Service
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={form.isBundle} onChange={(e) => set('isBundle', e.target.checked)} className="w-4 h-4 rounded border-slate-600" />
                Is Bundle
              </label>
              {editingId && (
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 rounded border-slate-600" />
                  Active
                </label>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={!form.name || !form.unitPrice} className="btn-primary">
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Product">
        <div className="space-y-4">
          <p className="text-slate-300">Are you sure you want to delete this product? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg hover:bg-red-500/30 transition-colors">
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
