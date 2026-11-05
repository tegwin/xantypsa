'use client';

// ============================================================
// Email → ticket status
// ============================================================
// Incoming mail arrives by Microsoft Graph webhook, not polling. There is
// deliberately no "fetch now" button: if mail is not arriving, the answer is to
// fix the subscription, not to pull manually and mask the fault.

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { PageHeader, Button, LoadingSpinner, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Mail, Ticket, RefreshCw, CheckCircle2, AlertTriangle, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function EmailProcessingPage() {
  const { data: status, loading, refetch } = useApi<any>('/api/settings/email/microsoft/status');
  const { data: tickets } = useApi<any>('/api/email/tickets');
  const [reconnecting, setReconnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const { data: cleanup, refetch: refetchCleanup } = useApi<any>('/api/settings/email/cleanup');

  // Saved on toggle rather than behind a Save button: there are two switches,
  // and a button to confirm two switches is a button nobody presses.
  const setCleanup = async (patch: Record<string, boolean>) => {
    await fetch('/api/settings/email/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cleanup, ...patch }),
    });
    toast.success('Saved');
    refetchCleanup();
  };
  const [diagnostics, setDiagnostics] = useState<any>(null);

  // Asks Microsoft the questions the webhook cannot answer for itself, so
  // "nothing is arriving" turns into a named cause rather than a guess.
  const runChecks = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/email/diagnostics');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not run the checks');
      setDiagnostics(body);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChecking(false);
    }
  };

  const reconnect = async () => {
    setReconnecting(true);
    try {
      const res = await fetch('/api/settings/email/microsoft/subscribe', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not connect the mailbox');
      toast.success(body.message ?? 'Mailbox connected');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReconnecting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const connected = status?.connected;
  const hoursLeft = status?.minutesRemaining != null ? Math.round(status.minutesRemaining / 60) : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Email Processing"
        subtitle="Incoming email becomes tickets automatically, pushed by Microsoft 365"
      />

      <div className="glass rounded-xl p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-4">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${
                connected ? 'bg-emerald-500/15' : 'bg-amber-500/15'
              }`}
            >
              {connected ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-white">
                {connected ? 'Mailbox connected' : 'Mailbox not connected'}
              </h2>
              {connected ? (
                <p className="mt-1 text-sm text-surface-400">
                  Microsoft 365 pushes each new message to Xanty PSA as it arrives - {' '}
                  <span className="text-surface-300">{status.mailbox}</span>. Nothing is polled and
                  nothing needs pressing.
                </p>
              ) : (
                <p className="mt-1 text-sm text-surface-400">
                  No active subscription, so incoming email is not creating tickets. Configure
                  Microsoft 365 under{' '}
                  <Link href="/settings/email" className="text-brand-400 hover:underline">
                    Settings → Email
                  </Link>
                  , then connect the mailbox.
                </p>
              )}
            </div>
          </div>

          <Button variant="secondary" loading={reconnecting} onClick={reconnect}>
            <RefreshCw className="h-4 w-4" />
            {connected ? 'Reconnect' : 'Connect mailbox'}
          </Button>
        </div>

        {connected && (
          <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-surface-500">Subscription</dt>
              <dd className="mt-1 font-mono text-xs text-surface-300">{status.subscriptionId}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-surface-500">Renews</dt>
              <dd className="mt-1 text-sm text-surface-300">
                Nightly at 03:00
                {hoursLeft != null && (
                  <span className={hoursLeft < 0 ? 'text-red-400' : 'text-surface-500'}>
                    {' '}
                    - {hoursLeft < 0 ? 'expired' : `${hoursLeft}h left`}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-surface-500">Expires</dt>
              <dd className="mt-1 text-sm text-surface-300">
                {status.expiresAt ? formatDate(status.expiresAt) : ' - '}
              </dd>
            </div>
          </dl>
        )}

        {connected && hoursLeft != null && hoursLeft < 0 && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
            This subscription has lapsed and email is not arriving. The nightly job will rebuild it,
            or press Reconnect to do it now. If it keeps lapsing, check that{' '}
            <code className="font-mono text-xs">CRON_SECRET</code> is set and the cron job is
            enabled in Vercel.
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-brand-400" />
          <h2 className="font-semibold text-white">What is kept from an email</h2>
        </div>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-surface-700 bg-surface-900/40 p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={cleanup?.stripSignature !== false}
              onChange={(e) => setCleanup({ stripSignature: e.target.checked })}
            />
            <span>
              <span className="block text-sm text-surface-100">Remove the sender's signature</span>
              <span className="block text-xs text-surface-500">
                Cuts the sign-off and the contact block beneath it, so a note holds the message
                rather than a business card. A reply that is only a sign-off is kept whole.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-surface-700 bg-surface-900/40 p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={cleanup?.stripQuotedHistory !== false}
              onChange={(e) => setCleanup({ stripQuotedHistory: e.target.checked })}
            />
            <span>
              <span className="block text-sm text-surface-100">Remove the quoted conversation</span>
              <span className="block text-xs text-surface-500">
                Drops the thread repeated below a reply. Turn this off if you need the full
                exchange on every note as a record.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-brand-400" />
            <h2 className="font-semibold text-white">Check the connection</h2>
          </div>
          <Button
            variant="secondary"
            loading={checking}
            icon={<Stethoscope className="h-4 w-4" />}
            onClick={runChecks}
          >
            Run checks
          </Button>
        </div>

        {!diagnostics ? (
          <p className="text-sm text-surface-400">
            Asks Microsoft whether the mailbox can be read and whether it still holds the
            subscription, and where it is sending notifications. Nothing is changed.
          </p>
        ) : (
          <div className="space-y-2">
            {diagnostics.checks.map((c: any) => (
              <div
                key={c.name}
                className="flex items-start gap-3 rounded-lg border border-surface-700 bg-surface-900/40 p-3"
              >
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-surface-100">{c.name}</p>
                  <p className="mt-0.5 break-words text-xs text-surface-400">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-6">
        <div className="mb-4 flex items-center gap-2">
          <Ticket className="h-4 w-4 text-brand-400" />
          <h2 className="font-semibold text-white">Recent tickets from email</h2>
        </div>

        {!tickets?.items?.length ? (
          <p className="py-4 text-sm text-surface-400">
            No tickets have been created from email yet.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {tickets.items.map((t: any) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="flex items-center justify-between gap-4 py-3 hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-surface-200">{t.title}</p>
                  <p className="mt-0.5 text-xs text-surface-500">
                    TKT-{String(t.ticketNumber).padStart(5, '0')} · {formatDate(t.createdAt)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-xl p-5">
        <div className="flex gap-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-surface-500" />
          <div className="text-sm text-surface-400">
            <p className="font-medium text-surface-200">Why there is no &ldquo;fetch now&rdquo;</p>
            <p className="mt-1">
              Microsoft 365 notifies Xanty PSA the moment a message lands, so tickets appear in
              seconds without anything on a timer. A manual fetch would only ever hide a broken
              subscription - if mail is not arriving, this page says so and the fix is to reconnect.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
