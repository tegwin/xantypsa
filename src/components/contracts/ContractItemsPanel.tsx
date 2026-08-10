'use client';

// ============================================================
// Products & services on a contract
// ============================================================
// These line items are what the contract actually charges. Their NET total
// becomes the contract's value, and the recurring invoice raised against the
// contract bills exactly these lines — so the two can never disagree.

import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { Button } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Line {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  /** What this line costs us per unit — wholesale seat price, licence fee, etc. */
  cost: number;
  taxRate: number;
  recurring: boolean;
}

const BLANK: Line = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  cost: 0,
  taxRate: 20,
  recurring: true,
};

export default function ContractItemsPanel({
  contractId,
  billingCycle,
  onSaved,
}: {
  contractId: string;
  billingCycle?: string;
  onSaved?: () => void;
}) {
  const { data, loading, refetch } = useApi<any>(`/api/contracts/${contractId}/items`);
  const { data: productsData } = useApi<any>('/api/products?limit=500');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.items) {
      setLines(
        data.items.map((i: any) => ({
          id: i.id,
          productId: i.productId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          cost: i.cost ?? 0,
          taxRate: i.taxRate,
          recurring: i.recurring,
        }))
      );
      setDirty(false);
    }
  }, [data]);

  const products = productsData?.items ?? [];

  const update = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    setDirty(true);
  };

  const addLine = () => {
    setLines((prev) => [...prev, { ...BLANK }]);
    setDirty(true);
  };

  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  // Picking a product fills the line so the user isn't retyping price and name.
  const pickProduct = (idx: number, productId: string) => {
    const p = products.find((x: any) => x.id === productId);
    update(idx, {
      productId: productId || null,
      ...(p
        ? {
            description: p.name,
            unitPrice: p.price ?? p.unitPrice ?? 0,
            cost: p.cost ?? 0,
            taxRate: p.taxRate ?? 20,
          }
        : {}),
    });
  };

  const net = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
  const tax = lines.reduce(
    (s, l) => s + (l.quantity || 0) * (l.unitPrice || 0) * ((l.taxRate ?? 20) / 100),
    0
  );
  // Cost of the services on the contract. Engineer time is costed separately
  // from time entries, so this is only part of the profit picture.
  const cost = lines.reduce((s, l) => s + (l.quantity || 0) * (l.cost || 0), 0);
  const margin = net - cost;
  const marginPct = net > 0 ? (margin / net) * 100 : 0;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: lines }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(err.error || 'Save failed');
      }
      toast.success('Contract value updated');
      setDirty(false);
      refetch();
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Products &amp; Services</h2>
          <p className="text-xs text-surface-400 mt-0.5">
            What this contract charges. The net total becomes the contract value and is what the
            recurring invoice bills.
          </p>
        </div>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addLine}>
          Add line
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-surface-400 py-4">
          No products or services yet — this is why the contract value is {formatCurrency(0)}. Add a
          line to price the contract.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-surface-500 px-1">
            <div className="col-span-3">Description</div>
            <div className="col-span-2">Product</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit price</div>
            <div className="col-span-1 text-right" title="What this line costs us per unit">
              Cost
            </div>
            <div className="col-span-1 text-right">Tax %</div>
            <div className="col-span-1 text-right">Net</div>
            <div className="col-span-1" />
          </div>

          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-3 input"
                value={l.description}
                placeholder="e.g. Managed endpoint"
                onChange={(e) => update(idx, { description: e.target.value })}
              />
              <select
                className="col-span-2 input"
                value={l.productId ?? ''}
                onChange={(e) => pickProduct(idx, e.target.value)}
              >
                <option value="">— none —</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number" step="any" className="col-span-1 input text-right"
                value={l.quantity}
                onChange={(e) => update(idx, { quantity: parseFloat(e.target.value) || 0 })}
              />
              <input
                type="number" step="any" className="col-span-2 input text-right"
                value={l.unitPrice}
                onChange={(e) => update(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
              />
              <input
                type="number" step="any" min="0" className="col-span-1 input text-right"
                value={l.cost}
                title="What this line costs us per unit"
                onChange={(e) => update(idx, { cost: parseFloat(e.target.value) || 0 })}
              />
              <input
                type="number" step="any" className="col-span-1 input text-right"
                value={l.taxRate}
                onChange={(e) => update(idx, { taxRate: parseFloat(e.target.value) || 0 })}
              />
              <div className="col-span-1 text-right text-sm text-surface-200">
                {formatCurrency((l.quantity || 0) * (l.unitPrice || 0))}
              </div>
              <button
                onClick={() => removeLine(idx)}
                className="col-span-1 justify-self-end p-1.5 rounded-md text-surface-500 hover:text-red-400 hover:bg-white/5"
                title="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex justify-end pt-3 border-t border-white/10 mt-3">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between text-surface-300">
                <span>Contract value (net)</span>
                <span className="font-semibold text-white">{formatCurrency(net)}</span>
              </div>
              <div className="flex justify-between text-surface-500 text-xs">
                <span>Tax</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-surface-400 text-xs">
                <span>Invoice total{billingCycle ? ` / ${billingCycle}` : ''}</span>
                <span>{formatCurrency(net + tax)}</span>
              </div>

              {cost > 0 && (
                <div className="pt-2 mt-2 border-t border-white/10 space-y-1">
                  <div className="flex justify-between text-surface-400 text-xs">
                    <span>Cost of services</span>
                    <span>−{formatCurrency(cost)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-300">Margin before labour</span>
                    <span className={margin >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {formatCurrency(margin)} ({marginPct.toFixed(1)}%)
                    </span>
                  </div>
                  <p className="text-[11px] text-surface-500 pt-1">
                    Engineer time is costed separately from time entries — this is the service
                    margin only.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {dirty && (
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => refetch()}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save &amp; update value</Button>
        </div>
      )}
    </div>
  );
}
