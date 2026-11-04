'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { PageHeader, LoadingSpinner, Modal, Input, Select, Button } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Plus, Trash2, Copy, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaymentWebhooksPage() {
  const { data, loading, refetch } = useApi<any>('/api/payment-webhooks');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', provider: 'generic' });
  const [saving, setSaving] = useState(false);
  // Shown once, straight after creation. It is never retrievable again.
  const [newSecret, setNewSecret] = useState<{ url: string; secret: string } | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const create = async () => {
    if (!form.name.trim()) return toast.error('Give the endpoint a name');
    setSaving(true);
    try {
      const res = await fetch('/api/payment-webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || 'Could not create it');
      setShowCreate(false);
      setForm({ name: '', provider: 'generic' });
      setNewSecret({ url: `${origin}/api/webhooks/payments/${json.publicId}`, secret: json.secret });
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/payment-webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    toast.success(isActive ? 'Endpoint switched on' : 'Endpoint switched off');
    refetch();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Any provider still posting to it will start failing, and its history goes too. Switch it off instead to keep the history.`)) return;
    await fetch(`/api/payment-webhooks/${id}`, { method: 'DELETE' });
    toast.success('Endpoint deleted');
    refetch();
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment webhooks"
        description="Let a payment provider tell the system when an invoice has been paid."
      >
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
          New endpoint
        </Button>
      </PageHeader>

      <div className="rounded-lg border border-surface-700 bg-surface-800/40 p-4 text-sm text-surface-300 space-y-2">
        <p className="font-medium text-surface-100">How a provider calls it</p>
        <p>
          POST JSON to the endpoint's URL with the secret in an{' '}
          <code className="font-mono text-xs text-brand-400">X-Webhook-Secret</code> header:
        </p>
        <pre className="overflow-x-auto rounded bg-surface-900 p-3 text-xs text-surface-300">{`{
  "invoiceNumber": "INV-00009",
  "amount": 250.00,
  "reference": "ch_3Ab...",
  "paidAt": "2026-11-04T10:00:00Z"
}`}</pre>
        <p className="text-surface-400">
          The invoice is marked paid, or partly paid if the amount is short of the total. Sending
          the same reference twice is ignored, so a provider retrying cannot pay an invoice twice.
        </p>
      </div>

      {!data?.items?.length ? (
        <div className="rounded-lg border border-surface-700 bg-surface-800/40 p-12 text-center">
          <p className="text-surface-300">No payment webhooks yet.</p>
          <p className="mt-1 text-sm text-surface-500">
            Create one, then paste its URL into Stripe, GoCardless or your bank feed.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((hook: any) => (
            <div key={hook.id} className="rounded-lg border border-surface-700 bg-surface-800/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-surface-100">
                    {hook.name}
                    <span className={`ml-2 rounded px-2 py-0.5 text-xs ${
                      hook.isActive ? 'bg-green-500/15 text-green-400' : 'bg-surface-700 text-surface-400'
                    }`}>
                      {hook.isActive ? 'Active' : 'Off'}
                    </span>
                  </p>
                  <button
                    onClick={() => copy(`${origin}/api/webhooks/payments/${hook.publicId}`, 'URL')}
                    className="mt-1 flex items-center gap-1.5 font-mono text-xs text-surface-400 hover:text-surface-200"
                  >
                    <Copy className="h-3 w-3" />
                    {origin}/api/webhooks/payments/{hook.publicId}
                  </button>
                  <p className="mt-1 text-xs text-surface-500">
                    {hook.provider} · {hook.lastReceivedAt
                      ? `last call ${formatDate(hook.lastReceivedAt)}`
                      : 'no calls received yet'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(hook.id, !hook.isActive)} className="btn-secondary text-xs">
                    {hook.isActive ? 'Switch off' : 'Switch on'}
                  </button>
                  <button
                    onClick={() => remove(hook.id, hook.name)}
                    aria-label={`Delete ${hook.name}`}
                    className="rounded-md p-2 text-surface-400 hover:bg-surface-700 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {hook.events?.length > 0 && (
                <div className="mt-3 border-t border-surface-700 pt-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Recent calls
                  </p>
                  <ul className="space-y-1">
                    {hook.events.map((e: any) => (
                      <li key={e.id} className="flex items-center gap-2 text-xs">
                        {e.success
                          ? <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
                          : <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />}
                        <span className="text-surface-400">{formatDate(e.createdAt)}</span>
                        <span className="text-surface-300">{e.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New payment webhook"
        footer={<>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button loading={saving} onClick={create}>Create endpoint</Button>
        </>}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} placeholder="Stripe live"
            onChange={(e: any) => setForm({ ...form, name: e.target.value })} />
          <Select label="Provider" value={form.provider}
            onChange={(e: any) => setForm({ ...form, provider: e.target ? e.target.value : e })}
            options={[
              { value: 'generic', label: 'Generic' },
              { value: 'stripe', label: 'Stripe' },
              { value: 'gocardless', label: 'GoCardless' },
              { value: 'xero', label: 'Xero' },
              { value: 'paypal', label: 'PayPal' },
            ]} />
          <p className="text-xs text-surface-500">
            The provider is recorded against each payment, so you can tell a card payment from a
            direct debit later.
          </p>
        </div>
      </Modal>

      {/* The secret is shown here and nowhere else, ever again. */}
      <Modal open={!!newSecret} onClose={() => setNewSecret(null)} title="Copy the secret now"
        footer={<Button onClick={() => setNewSecret(null)}>Done</Button>}>
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            Only a digest of this secret is stored, so this is the one time it can be shown. If it
            is lost, delete the endpoint and make a new one.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-surface-400">URL</label>
            <div className="flex gap-2">
              <input readOnly value={newSecret?.url ?? ''} className="w-full font-mono text-xs" />
              <button onClick={() => copy(newSecret!.url, 'URL')} className="btn-secondary">Copy</button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-surface-400">
              X-Webhook-Secret
            </label>
            <div className="flex gap-2">
              <input readOnly value={newSecret?.secret ?? ''} className="w-full font-mono text-xs" />
              <button onClick={() => copy(newSecret!.secret, 'Secret')} className="btn-secondary">Copy</button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
