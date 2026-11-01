'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/useApi';
import {
  PageHeader,
  Modal,
  Button,
  Input,
  DataTable,
  EmptyState,
  LoadingSpinner,
  StatusBadge,
  Badge,
  ConfirmDialog,
} from '@/components/ui';
import { Webhook, Plus, Pencil, Trash2, Play, ScrollText, RefreshCw } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

const WEBHOOK_EVENTS = [
  { group: 'Company', events: ['company.created', 'company.updated', 'company.deleted'] },
  { group: 'Contact', events: ['contact.created', 'contact.updated', 'contact.deleted'] },
  { group: 'Ticket', events: ['ticket.created', 'ticket.updated', 'ticket.status_changed', 'ticket.deleted'] },
  { group: 'Opportunity', events: ['opportunity.created', 'opportunity.updated', 'opportunity.won', 'opportunity.lost'] },
  { group: 'Invoice', events: ['invoice.created', 'invoice.sent', 'invoice.paid'] },
];

interface WebhookItem {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  status: string;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  event: string;
  statusCode: number;
  success: boolean;
  responseTime: number;
  createdAt: string;
}

const emptyForm = {
  name: '',
  url: '',
  secret: '',
  events: [] as string[],
};

export default function WebhooksPage() {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WebhookItem | null>(null);
  const [deleteWebhook, setDeleteWebhook] = useState<WebhookItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [testing, setTesting] = useState<string | null>(null);
  const [logsWebhook, setLogsWebhook] = useState<WebhookItem | null>(null);

  const { data, loading, refetch } = useApi<{ webhooks: WebhookItem[] }>('/api/webhooks');
  const { data: logsData, loading: logsLoading } = useApi<{ logs: DeliveryLog[] }>(
    logsWebhook ? `/api/webhooks/${logsWebhook.id}/logs` : null
  );

  const webhooks = data?.webhooks || [];
  const logs = logsData?.logs || [];

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (wh: WebhookItem) => {
    setEditing(wh);
    setForm({
      name: wh.name,
      url: wh.url,
      secret: wh.secret || '',
      events: wh.events,
    });
    setShowModal(true);
  };

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const toggleGroup = (events: string[]) => {
    const allSelected = events.every((e) => form.events.includes(e));
    setForm((prev) => ({
      ...prev,
      events: allSelected
        ? prev.events.filter((e) => !events.includes(e))
        : Array.from(new Set([...prev.events, ...events])),
    }));
  };

  const generateSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = 'whsec_';
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev) => ({ ...prev, secret }));
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      url: form.url,
      secret: form.secret || undefined,
      events: form.events,
    };

    if (editing) {
      await apiPatch(`/api/webhooks/${editing.id}`, payload);
    } else {
      await apiPost('/api/webhooks', payload);
    }

    setShowModal(false);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteWebhook) return;
    await apiDelete(`/api/webhooks/${deleteWebhook.id}`);
    setDeleteWebhook(null);
    refetch();
  };

  const handleTest = async (wh: WebhookItem) => {
    setTesting(wh.id);
    try {
      const res = await fetch(`/api/webhooks/${wh.id}/test`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Test delivered: ${json.statusCode || 'OK'}`);
      } else {
        toast.error(json.error || 'Test delivery failed');
      }
    } catch {
      toast.error('Test delivery failed');
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Webhooks" subtitle="Configure webhook endpoints for real-time event notifications">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
          Add Webhook
        </Button>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        {loading ? (
          <LoadingSpinner />
        ) : !webhooks.length ? (
          <EmptyState
            icon={<Webhook className="w-12 h-12" />}
            title="No webhooks configured"
            description="Add a webhook endpoint to receive real-time notifications about events in your CRM."
            actionLabel="Add Webhook"
            onAction={openAdd}
          />
        ) : (
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (wh: WebhookItem) => (
                  <div>
                    <div className="font-medium text-white">{wh.name}</div>
                    <div className="text-xs text-slate-500 font-mono truncate max-w-[300px]">{wh.url}</div>
                  </div>
                ),
              },
              {
                key: 'events',
                label: 'Events',
                render: (wh: WebhookItem) => (
                  <span className="text-slate-300 text-sm">
                    {wh.events.length} event{wh.events.length !== 1 ? 's' : ''}
                  </span>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (wh: WebhookItem) => <StatusBadge status={wh.status} />,
              },
              {
                key: 'lastTriggeredAt',
                label: 'Last Triggered',
                render: (wh: WebhookItem) => (
                  <span className="text-slate-400 text-sm">
                    {wh.lastTriggeredAt ? formatDate(wh.lastTriggeredAt) : 'Never'}
                  </span>
                ),
              },
              {
                key: 'actions',
                label: '',
                className: 'w-36 text-right',
                render: (wh: WebhookItem) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTest(wh); }}
                      disabled={testing === wh.id}
                      className="p-1.5 rounded-md hover:bg-surface-700 text-slate-400 hover:text-brand-400 transition-colors disabled:opacity-50"
                      title="Send test"
                    >
                      {testing === wh.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLogsWebhook(wh); }}
                      className="p-1.5 rounded-md hover:bg-surface-700 text-slate-400 hover:text-white transition-colors"
                      title="View logs"
                    >
                      <ScrollText className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(wh); }}
                      className="p-1.5 rounded-md hover:bg-surface-700 text-slate-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteWebhook(wh); }}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ),
              },
            ]}
            data={webhooks}
          />
        )}
      </div>

      {/* Add/Edit Webhook Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Edit Webhook' : 'Add Webhook'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.url || !form.events.length}>
              {editing ? 'Save Changes' : 'Add Webhook'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Slack Notifications"
          />

          <Input
            label="Endpoint URL"
            required
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://example.com/webhooks"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Signing Secret</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                placeholder="Optional signing secret"
                className="flex-1 rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 font-mono"
              />
              <Button variant="secondary" size="sm" onClick={generateSecret}>
                Generate
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-surface-300">
              Events <span className="text-red-400">*</span>
            </label>
            <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2">
              {WEBHOOK_EVENTS.map((group) => {
                const allSelected = group.events.every((e) => form.events.includes(e));
                return (
                  <div key={group.group}>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.events)}
                      className="flex items-center gap-2 mb-2"
                    >
                      <input
                        type="checkbox"
                        checked={allSelected}
                        readOnly
                        className="rounded border-surface-600 bg-surface-800 text-brand-600 focus:ring-brand-500/40"
                      />
                      <span className="text-sm font-medium text-surface-200">{group.group}</span>
                    </button>
                    <div className="ml-6 grid grid-cols-2 gap-1.5">
                      {group.events.map((event) => (
                        <label key={event} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.events.includes(event)}
                            onChange={() => toggleEvent(event)}
                            className="rounded border-surface-600 bg-surface-800 text-brand-600 focus:ring-brand-500/40"
                          />
                          <span className="text-sm text-surface-400 font-mono">{event}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {form.events.length > 0 && (
              <p className="text-xs text-slate-500">{form.events.length} event(s) selected</p>
            )}
          </div>
        </div>
      </Modal>

      {/* Delivery Logs Modal */}
      <Modal
        open={!!logsWebhook}
        onClose={() => setLogsWebhook(null)}
        title={`Delivery Logs - ${logsWebhook?.name || ''}`}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setLogsWebhook(null)}>Close</Button>
        }
      >
        {logsLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !logs.length ? (
          <p className="text-center text-slate-400 py-8">No delivery logs yet.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      log.success ? 'bg-green-400' : 'bg-red-400'
                    }`}
                  />
                  <div>
                    <span className="text-sm font-mono text-surface-200">{log.event}</span>
                    <div className="text-xs text-slate-500">{formatDate(log.createdAt)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <Badge>{log.statusCode}</Badge>
                  <span className="text-slate-400">{log.responseTime}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteWebhook}
        onClose={() => setDeleteWebhook(null)}
        onConfirm={handleDelete}
        title="Delete Webhook"
        message={`Are you sure you want to delete "${deleteWebhook?.name}"? This webhook will stop receiving events immediately.`}
        confirmLabel="Delete Webhook"
      />
    </div>
  );
}
