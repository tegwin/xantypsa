'use client';

// ============================================================
// Email templates
// ============================================================
// Grouped by what they are about, because a flat list put quote templates and
// ticket templates side by side and offered quote variables while editing a
// ticket email - which is how {quote_number} ends up in an acknowledgement.

import { useState } from 'react';
import { useApi, apiPost } from '@/hooks/useApi';
import { PageHeader, Modal } from '@/components/ui';
import toast from 'react-hot-toast';

/** Variables each family of template actually receives when it is sent. */
const SHARED = ['{customer_name}', '{company_name}', '{company_email}'];

const SECTIONS = [
  {
    key: 'quote',
    title: 'Quotes',
    description: 'Sent to a customer about a quotation.',
    match: (slug: string) => slug.startsWith('quote_'),
    variables: [
      '{quote_number}', '{quote_title}', '{total}', '{currency_symbol}',
      '{issue_date}', '{expiry_date}', '{quote_link}', '{notes}', ...SHARED,
    ],
  },
  {
    key: 'ticket',
    title: 'Service desk',
    description: 'Sent to a customer when their ticket is raised or moves on.',
    match: (slug: string) => slug.startsWith('ticket_'),
    variables: [
      '{ticket_number}', '{ticket_title}', '{status}', '{priority}',
      '{assigned_to}', ...SHARED,
    ],
  },
  {
    key: 'other',
    title: 'Other',
    description: 'Everything else.',
    match: () => true,
    variables: SHARED,
  },
];

function sectionFor(slug: string) {
  return SECTIONS.find((s) => s.match(slug)) ?? SECTIONS[SECTIONS.length - 1];
}

/**
 * Stand-in values for the preview.
 *
 * Obviously fake on sight, so nobody mistakes a preview for a real customer's
 * email, but shaped like the real thing so the layout is honest.
 */
const SAMPLE: Record<string, string> = {
  customer_name: 'Alex Morgan',
  company_name: 'Your Company',
  company_email: 'support@yourcompany.com',
  quote_number: 'QTE-00042',
  quote_title: 'Firewall replacement',
  total: '1,250.00',
  currency_symbol: '£',
  issue_date: '5 November 2026',
  expiry_date: '19 November 2026',
  quote_link: '#',
  notes: 'Includes installation and one year of support.',
  ticket_number: '42',
  ticket_title: 'Printer will not come online',
  status: 'New',
  priority: 'Medium',
  assigned_to: 'Sam Patel',
};

function fillSample(text: string): string {
  let out = text ?? '';
  for (const [key, value] of Object.entries(SAMPLE)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return out;
}

export default function EmailTemplatesPage() {
  const { data, loading, refetch } = useApi<any>('/api/settings/email-templates');
  const [editing, setEditing] = useState<any>(null);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  const save = async () => {
    if (!editing) return;
    await apiPost('/api/settings/email-templates', {
      slug: editing.slug,
      name: editing.name,
      subject: editing.subject,
      body: editing.body,
    });
    toast.success('Template saved');
    setEditing(null);
    refetch();
  };

  const open = (t: any) => {
    setTab('edit');
    setEditing({ ...t });
  };

  if (loading) return <div className="p-8 text-slate-400">Loading...</div>;

  const items = data?.items || [];
  const variables = editing ? sectionFor(editing.slug).variables : [];

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Email Templates"
        subtitle="What Xanty PSA sends to your customers, and how it reads"
      />

      <div className="space-y-8 max-w-3xl">
        {SECTIONS.map((section) => {
          const inSection = items.filter((t: any) => sectionFor(t.slug).key === section.key);
          if (!inSection.length) return null;

          return (
            <section key={section.key}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {section.title}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{section.description}</p>

              <div className="mt-3 space-y-3">
                {inSection.map((t: any) => (
                  <div key={t.slug} className="glass rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-white font-medium">{t.name}</p>
                      <p className="truncate text-sm text-slate-400">{t.subject}</p>
                    </div>
                    <button onClick={() => open(t)} className="btn-secondary text-sm shrink-0">
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {editing && (
        <Modal title={`Edit: ${editing.name}`} onClose={() => setEditing(null)} size="lg">
          <div className="space-y-4">
            <div className="flex gap-1 border-b border-white/10">
              {([
                { key: 'edit' as const, label: 'Edit' },
                { key: 'preview' as const, label: 'Preview' },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  aria-current={tab === t.key ? 'page' : undefined}
                  className={`rounded-t-md px-4 py-2 text-sm transition-colors ${
                    tab === t.key
                      ? 'border-b-2 border-brand-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'edit' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Subject</label>
                  <input
                    value={editing.subject}
                    onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Body (HTML)</label>
                  <textarea
                    rows={12}
                    value={editing.body}
                    onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                    className="w-full font-mono text-xs"
                  />
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-xs text-slate-400 mb-2">
                    Variables for {sectionFor(editing.slug).title.toLowerCase()} - click to insert:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {variables.map((v) => (
                      <button
                        key={v}
                        onClick={() => setEditing({ ...editing, body: editing.body + v })}
                        className="text-xs px-2 py-1 rounded bg-brand-600/20 text-brand-400 hover:bg-brand-600/30"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Subject</p>
                  <p className="mt-1 text-sm text-white">
                    {fillSample(editing.subject) || '(no subject)'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    The ticket reference is added to the subject by the system when it sends, so a
                    reply finds its way back even if this template does not mention it.
                  </p>
                </div>

                {/* Rendered on a white page, in a sandboxed frame: this is
                    customer-authored HTML and a mail client shows it light. */}
                <div className="overflow-hidden rounded-lg border border-white/10 bg-white">
                  <iframe
                    title="Email preview"
                    sandbox=""
                    className="h-[340px] w-full"
                    srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;font-family:Arial,sans-serif;color:#111">${fillSample(
                      editing.body
                    )}</body>`}
                  />
                </div>

                <details className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <summary className="cursor-pointer text-xs text-slate-400">
                    HTML that will be sent
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] text-slate-300">
{fillSample(editing.body)}
                  </pre>
                </details>

                <p className="text-xs text-slate-500">
                  Sample values are shown in place of the variables. Nothing here is a real customer.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save Template</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
