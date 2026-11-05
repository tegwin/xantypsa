'use client';

// ============================================================
// Files on a ticket
// ============================================================
// Whatever arrived on the email, plus anything an agent adds afterwards. Files
// are served through the app rather than straight from storage, so a link
// cannot be forwarded to somebody outside the tenant.

import { useEffect, useRef, useState } from 'react';
import { Paperclip, Download, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  sourceEmail: string | null;
  createdAt: string;
}

/** Bytes to something a person reads at a glance. */
function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TicketAttachments({ ticketId }: { ticketId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/attachments`);
      const body = await res.json();
      setItems(body.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not attach that file');
      toast.success(`${file.name} attached`);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const remove = async (a: Attachment) => {
    if (!confirm(`Remove ${a.filename}?`)) return;
    const res = await fetch(`/api/tickets/${ticketId}/attachments?attachmentId=${a.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) return toast.error('Could not remove it');
    toast.success('Attachment removed');
    load();
  };

  return (
    <div className="glass-panel p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-brand-400" />
          <h3 className="font-semibold text-white">
            Attachments{items.length ? ` (${items.length})` : ''}
          </h3>
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="btn-secondary text-sm"
        >
          <Upload className="mr-1 inline h-3.5 w-3.5" />
          {uploading ? 'Attaching...' : 'Attach a file'}
        </button>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>

      {loading ? (
        <p className="text-sm text-surface-400">Loading...</p>
      ) : !items.length ? (
        <p className="text-sm text-surface-400">
          Nothing attached. Files sent in with an email appear here automatically.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-surface-700/30 bg-surface-700/20 p-3"
            >
              <div className="min-w-0">
                <a
                  href={`/api/tickets/${ticketId}/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-white hover:text-brand-400"
                >
                  {a.filename}
                </a>
                <p className="mt-0.5 text-xs text-surface-500">
                  {readableSize(a.size)}
                  {a.sourceEmail ? ` - emailed by ${a.sourceEmail}` : ' - uploaded'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={`/api/tickets/${ticketId}/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${a.filename}`}
                  className="rounded-md p-2 text-surface-400 hover:bg-surface-700 hover:text-white"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => remove(a)}
                  aria-label={`Remove ${a.filename}`}
                  className="rounded-md p-2 text-surface-400 hover:bg-surface-700 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
