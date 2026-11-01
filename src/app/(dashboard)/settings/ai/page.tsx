'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/useApi';
import { PageHeader, Button, Modal, Input, Select, LoadingSpinner, Badge } from '@/components/ui';
import toast from 'react-hot-toast';
import { PROVIDERS, DEFAULT_PROVIDER_KIND, type ProviderMeta } from '@/lib/ai/provider-catalogue';

interface ProviderRow {
  id: string;
  provider: string;
  label: string;
  model: string;
  baseUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
}

const BLANK = { provider: DEFAULT_PROVIDER_KIND as string, label: '', model: '', apiKey: '', baseUrl: '', isDefault: false };

export default function AiSettingsPage() {
  const { data, loading, error, refetch } = useApi<any>('/api/settings/ai-providers');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const catalogue: ProviderMeta[] = PROVIDERS;
  const rows: ProviderRow[] = data?.items ?? [];
  const meta = catalogue.find((c) => c.kind === form.provider);

  const openAdd = (kind: string) => {
    const m = catalogue.find((c) => c.kind === kind);
    setForm({
      ...BLANK,
      provider: kind,
      model: m?.models[0]?.value ?? '',
      baseUrl: kind === 'local' ? 'http://localhost:11434/v1' : '',
    });
    setShowAdd(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiPost('/api/settings/ai-providers', form);
      if (res) {
        toast.success('Provider added');
        setShowAdd(false);
        refetch();
      }
    } finally {
      setSaving(false);
    }
  };

  const test = async (id: string) => {
    setTesting(id);
    try {
      const res: any = await apiPost(`/api/settings/ai-providers/${id}`, {});
      if (res?.ok) toast.success(`Connected - model replied "${res.reply}"`);
      else toast.error(res?.error || 'Connection failed');
    } finally {
      setTesting(null);
    }
  };

  const makeDefault = async (id: string) => {
    await apiPatch(`/api/settings/ai-providers/${id}`, { isDefault: true });
    refetch();
  };

  const remove = async (id: string, label: string) => {
    if (!confirm(`Remove "${label}"? The stored API key is deleted.`)) return;
    await apiDelete(`/api/settings/ai-providers/${id}`);
    toast.success('Provider removed');
    refetch();
  };

  if (loading) return <LoadingSpinner />;

  const primary = catalogue.filter((c) => c.tier === 'primary');
  const secondary = catalogue.filter((c) => c.tier === 'secondary');

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="AI"
        description="Connect Xanty PSA to a language model. It learns your data model automatically and can answer questions and create records."
      />

      {error && (
        <div className="glass rounded-xl p-4 border border-red-500/40 text-red-300 text-sm">
          <strong>Could not load connected providers.</strong> {error}
          <button onClick={refetch} className="ml-2 underline hover:text-red-200">Retry</button>
        </div>
      )}

      {data && !data.encryptionConfigured && (
        <div className="glass rounded-xl p-4 border border-amber-500/40 text-amber-300 text-sm">
          <strong>AI_ENCRYPTION_KEY is not set.</strong> API keys cannot be stored until it is.
          Generate one with <code className="text-amber-200">openssl rand -hex 32</code> and add it to <code>.env</code>.
        </div>
      )}

      {/* Configured providers */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-4">Connected providers</h2>

        {rows.length === 0 ? (
          <p className="text-surface-400 text-sm">
            Nothing connected yet. Add Anthropic or OpenAI below to switch the assistant on.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-surface-100 font-medium truncate">{r.label}</span>
                    {r.isDefault && <Badge variant="status" status="active">Default</Badge>}
                    {!r.isActive && <Badge variant="status" status="inactive">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {r.model}
                    {r.baseUrl ? ` · ${r.baseUrl}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" loading={testing === r.id} onClick={() => test(r.id)}>
                    Test
                  </Button>
                  {!r.isDefault && r.provider !== 'local' && (
                    <Button variant="secondary" onClick={() => makeDefault(r.id)}>
                      Make default
                    </Button>
                  )}
                  <Button variant="secondary" onClick={() => remove(r.id, r.label)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add a provider */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-surface-100 mb-1">Add a provider</h2>
        <p className="text-sm text-surface-400 mb-4">
          Anthropic or OpenAI are recommended for day-to-day use.
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {primary.map((c) => (
            <button
              key={c.kind}
              onClick={() => openAdd(c.kind)}
              className="text-left bg-white/5 hover:bg-white/10 rounded-lg p-4 transition-colors"
            >
              <div className="text-surface-100 font-medium">{c.label}</div>
              <div className="text-xs text-surface-500 mt-1">{c.description}</div>
            </button>
          ))}
        </div>

        {secondary.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-surface-400 mt-6 mb-2">Optional fallback</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {secondary.map((c) => (
                <button
                  key={c.kind}
                  onClick={() => openAdd(c.kind)}
                  className="text-left bg-white/5 hover:bg-white/10 rounded-lg p-4 transition-colors"
                >
                  <div className="text-surface-100 font-medium">{c.label}</div>
                  <div className="text-xs text-surface-500 mt-1">{c.description}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={`Add ${meta?.label ?? 'provider'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button loading={saving} onClick={save}>Add provider</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.label}
            placeholder={meta?.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />

          <Select
            label="Model"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            options={(meta?.models ?? []).map((m) => ({ value: m.value, label: m.label }))}
          />

          {meta?.requiresApiKey && (
            <Input
              label="API key"
              type="password"
              value={form.apiKey}
              placeholder={form.provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          )}

          {meta?.requiresBaseUrl && (
            <Input
              label="Base URL"
              value={form.baseUrl}
              placeholder="http://localhost:11434/v1"
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          )}

          {meta?.tier === 'primary' && (
            <label className="flex items-center gap-2 text-sm text-surface-300">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Use as the default model
            </label>
          )}

          {meta?.tier === 'secondary' && (
            <p className="text-xs text-surface-500">
              Self-hosted models run entirely on your own infrastructure, but are less reliable at
              multi-step tasks. They cannot be set as the default.
            </p>
          )}

          <p className="text-xs text-surface-500">
            The key is encrypted before it is stored and is never sent back to the browser.
          </p>
        </div>
      </Modal>
    </div>
  );
}
