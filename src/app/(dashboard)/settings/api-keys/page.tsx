'use client';

import { useState } from 'react';
import { useApi, apiPost, apiDelete } from '@/hooks/useApi';
import {
  PageHeader,
  Modal,
  Button,
  Input,
  DataTable,
  EmptyState,
  LoadingSpinner,
  StatusBadge,
  ConfirmDialog,
} from '@/components/ui';
import { Key, Plus, Copy, Check, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  status: string;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [revokeKey, setRevokeKey] = useState<ApiKey | null>(null);

  const { data, loading, refetch } = useApi<{ keys: ApiKey[] }>('/api/settings/api-keys');

  const keys = data?.keys || [];

  const handleCreate = async () => {
    const res = await apiPost('/api/settings/api-keys', { name: keyName });
    if (res?.key) {
      setNewKeyValue(res.key);
      setShowCreate(false);
      setKeyName('');
      refetch();
    }
  };

  const handleCopy = async () => {
    if (!newKeyValue) return;
    await navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!revokeKey) return;
    await apiDelete(`/api/settings/api-keys/${revokeKey.id}`);
    setRevokeKey(null);
    refetch();
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="API Keys" subtitle="Manage API keys for external integrations">
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
          Generate New Key
        </Button>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        {loading ? (
          <LoadingSpinner />
        ) : !keys.length ? (
          <EmptyState
            icon={<Key className="w-12 h-12" />}
            title="No API keys"
            description="Generate an API key to integrate with external services."
            actionLabel="Generate New Key"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (k: ApiKey) => (
                  <span className="font-medium text-white">{k.name}</span>
                ),
              },
              {
                key: 'keyPrefix',
                label: 'Key',
                render: (k: ApiKey) => (
                  <span className="font-mono text-slate-400 text-xs">
                    {k.keyPrefix}...
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (k: ApiKey) => <StatusBadge status={k.status} />,
              },
              {
                key: 'lastUsedAt',
                label: 'Last Used',
                render: (k: ApiKey) => (
                  <span className="text-slate-400 text-sm">
                    {k.lastUsedAt ? formatDate(k.lastUsedAt) : 'Never'}
                  </span>
                ),
              },
              {
                key: 'createdAt',
                label: 'Created',
                render: (k: ApiKey) => (
                  <span className="text-slate-400 text-sm">{formatDate(k.createdAt)}</span>
                ),
              },
              {
                key: 'actions',
                label: '',
                className: 'w-16 text-right',
                render: (k: ApiKey) => (
                  <button
                    onClick={(e) => { e.stopPropagation(); setRevokeKey(k); }}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                    title="Revoke key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ),
              },
            ]}
            data={keys}
          />
        )}
      </div>

      {/* Create Key Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Generate New API Key"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!keyName.trim()}>
              Generate Key
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Key Name"
            required
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="e.g. Production Integration"
          />
          <p className="text-xs text-slate-500">
            Give your key a descriptive name so you can identify it later.
          </p>
        </div>
      </Modal>

      {/* Show Generated Key Modal */}
      <Modal
        open={!!newKeyValue}
        onClose={() => setNewKeyValue(null)}
        title="API Key Generated"
        size="md"
        footer={
          <Button onClick={() => setNewKeyValue(null)}>Done</Button>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-surface-900 rounded-lg border border-surface-600">
            <p className="text-xs text-slate-400 mb-2">Your API key (shown only once):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-brand-400 font-mono break-all select-all">
                {newKeyValue}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-2 rounded-md hover:bg-surface-700 text-slate-400 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-400">
              Make sure to copy this key now. You will not be able to see it again.
            </p>
          </div>
        </div>
      </Modal>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={!!revokeKey}
        onClose={() => setRevokeKey(null)}
        onConfirm={handleRevoke}
        title="Revoke API Key"
        message={`Are you sure you want to revoke "${revokeKey?.name}"? Any integrations using this key will stop working immediately.`}
        confirmLabel="Revoke Key"
      />
    </div>
  );
}
