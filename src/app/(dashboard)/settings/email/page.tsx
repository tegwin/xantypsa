'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApi, apiPost } from '@/hooks/useApi';
import { PageHeader } from '@/components/ui';
import toast from 'react-hot-toast';
import { Mail, Cloud, Server, ExternalLink, Zap } from 'lucide-react';

type EmailProvider = 'smtp' | 'microsoft' | 'google';

export default function EmailSettingsPage() {
  const { data, loading } = useApi<any>('/api/settings/email');
  const { data: msData, loading: msLoading } = useApi<any>('/api/settings/email/microsoft');
  const [provider, setProvider] = useState<EmailProvider>('microsoft');
  const [form, setForm] = useState({ host: '', port: 587, username: '', password: '', tls: true, fromEmail: '', fromName: '' });
  const [msForm, setMsForm] = useState({ clientId: '', clientSecret: '', tenantId: '', mailbox: '' });
  const [saving, setSaving] = useState(false);
  const [msSaving, setMsSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showMsInstructions, setShowMsInstructions] = useState(false);

  useEffect(() => {
    if (data) {
      setForm(data);
      // Auto-detect active provider
      if (data.host) setProvider('smtp');
    }
  }, [data]);
  useEffect(() => {
    if (msData) {
      setMsForm({
        clientId: msData.clientId || '',
        clientSecret: msData.clientSecret || '',
        tenantId: msData.tenantId || '',
        mailbox: msData.mailbox || '',
      });
      if (msData.clientId) setProvider('microsoft');
    }
  }, [msData]);

  const save = async () => {
    setSaving(true);
    await apiPost('/api/settings/email', form);
    toast.success('SMTP settings saved');
    setSaving(false);
  };

  const saveMicrosoft = async () => {
    setMsSaving(true);
    await apiPost('/api/settings/email/microsoft', msForm);
    toast.success('Microsoft 365 settings saved');
    setMsSaving(false);
  };

  const testEmail = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/settings/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.success) toast.success(data.message || 'Test email sent!');
      else toast.error(data.error || 'Failed to send test email');
    } catch { toast.error('Failed to send test email'); }
    setTesting(false);
  };

  if (loading || msLoading) return <div className="p-8 text-slate-400">Loading...</div>;

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Email Settings" subtitle="Configure your email provider for sending and receiving" />

      {/* Provider Selector */}
      <div className="flex gap-3 mb-6">
        {[
          { key: 'microsoft' as const, label: 'Microsoft 365', desc: 'Exchange Online / Graph API', icon: Cloud },
          { key: 'google' as const, label: 'Google Workspace', desc: 'Gmail API (coming soon)', icon: Mail },
          { key: 'smtp' as const, label: 'SMTP', desc: 'Custom SMTP server', icon: Server },
        ].map(p => (
          <button key={p.key} onClick={() => setProvider(p.key)}
            className={`flex-1 p-4 rounded-xl border text-left transition-all ${provider === p.key ? 'border-brand-500 bg-brand-600/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
            <div className="flex items-center gap-2 mb-1">
              <p.icon className={`w-4 h-4 ${provider === p.key ? 'text-brand-400' : 'text-slate-400'}`} />
              <span className={`font-semibold text-sm ${provider === p.key ? 'text-brand-400' : 'text-white'}`}>{p.label}</span>
            </div>
            <p className="text-xs text-slate-400">{p.desc}</p>
          </button>
        ))}
      </div>

      {/* SMTP Settings */}
      {provider === 'smtp' && (
        <div className="glass rounded-xl p-6 max-w-2xl space-y-4">
          <h3 className="text-lg font-semibold text-white">SMTP Configuration</h3>
          <p className="text-sm text-slate-400">Configure SMTP settings for sending outbound emails (Gmail, Outlook, or any SMTP provider).</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">SMTP Host *</label>
              <input value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} className="w-full" placeholder="smtp.gmail.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Port</label>
              <input type="number" value={form.port} onChange={e => setForm({ ...form, port: Number(e.target.value) })} className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
              <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">From Email</label>
              <input type="email" value={form.fromEmail} onChange={e => setForm({ ...form, fromEmail: e.target.value })} className="w-full" placeholder="noreply@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">From Name</label>
              <input value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })} className="w-full" placeholder="Your Company" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.tls} onChange={e => setForm({ ...form, tls: e.target.checked })} className="rounded" />
            <span className="text-sm text-slate-300">Use TLS encryption</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Settings'}</button>
            <button onClick={testEmail} disabled={testing || !form.host} className="btn-secondary">{testing ? 'Sending...' : 'Send Test Email'}</button>
          </div>
        </div>
      )}

      {/* Microsoft 365 Settings */}
      {provider === 'microsoft' && (
        <div className="space-y-6 max-w-2xl">
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Microsoft 365 Configuration</h3>
                <p className="text-sm text-slate-400">Connect to Microsoft 365 to send emails and process incoming emails into tickets.</p>
              </div>
              <button onClick={() => setShowMsInstructions(!showMsInstructions)} className="btn-secondary text-xs flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Setup Guide
              </button>
            </div>

            {/* Setup Instructions */}
            {showMsInstructions && (
              <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4 text-sm space-y-3">
                <h4 className="text-blue-400 font-semibold">Microsoft 365 Setup Instructions</h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-300">
                  <li><strong>Create an Azure AD App Registration:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1 text-slate-400">
                      <li>Go to <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Azure Portal → App Registrations</a></li>
                      <li>Click "New Registration"</li>
                      <li>Name: "XantyPSA Email Integration"</li>
                      <li>Supported account types: "Single tenant"</li>
                      <li>Click "Register"</li>
                    </ul>
                  </li>
                  <li><strong>Note the Application (Client) ID and Directory (Tenant) ID</strong> from the overview page</li>
                  <li><strong>Create a Client Secret:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1 text-slate-400">
                      <li>Go to "Certificates & secrets" → "New client secret"</li>
                      <li>Set an expiry (recommended: 24 months)</li>
                      <li>Copy the secret value immediately (shown only once)</li>
                    </ul>
                  </li>
                  <li><strong>Set API Permissions:</strong>
                    <ul className="list-disc list-inside ml-4 mt-1 text-slate-400">
                      <li>Go to "API Permissions" → "Add a permission" → "Microsoft Graph"</li>
                      <li>Select <strong>Application permissions</strong> (not Delegated)</li>
                      <li>Add: <code className="bg-white/10 px-1 rounded">Mail.Read</code> - Read all mailboxes</li>
                      <li>Add: <code className="bg-white/10 px-1 rounded">Mail.ReadWrite</code> - Mark emails as read</li>
                      <li>Add: <code className="bg-white/10 px-1 rounded">Mail.Send</code> - Send emails</li>
                      <li>Click "Grant admin consent" (requires Global Admin)</li>
                    </ul>
                  </li>
                  <li><strong>Enter the details below</strong> and click Save. Then use "Process Now" to test.</li>
                </ol>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Application (Client) ID *</label>
                <input value={msForm.clientId} onChange={e => setMsForm({ ...msForm, clientId: e.target.value })} className="w-full" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Client Secret *</label>
                <input type="password" value={msForm.clientSecret} onChange={e => setMsForm({ ...msForm, clientSecret: e.target.value })} className="w-full" placeholder="Application secret value" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Directory (Tenant) ID *</label>
                <input value={msForm.tenantId} onChange={e => setMsForm({ ...msForm, tenantId: e.target.value })} className="w-full" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Mailbox Email Address *</label>
                <input type="email" value={msForm.mailbox} onChange={e => setMsForm({ ...msForm, mailbox: e.target.value })} className="w-full" placeholder="support@yourcompany.com" />
                <p className="text-xs text-slate-500 mt-1">The mailbox to monitor for incoming emails and send from</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2 flex-wrap">
              <button onClick={saveMicrosoft} disabled={msSaving} className="btn-primary">{msSaving ? 'Saving...' : 'Save Settings'}</button>
              <button onClick={async () => {
                const res = await fetch('/api/settings/email/microsoft/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                const data = await res.json();
                if (data.success) toast.success(data.message);
                else toast.error(data.error || 'Failed to activate webhook');
              }} disabled={!msForm.clientId || !msForm.mailbox} className="btn-secondary">
                Connect Mailbox
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              <strong>Connect Mailbox</strong> registers with Microsoft so new email is pushed
              straight to XantyPSA as tickets. It renews itself; if the mailbox is quiet for
              several days and the connection lapses, press it again.
            </p>
          </div>

          {/* How mail actually arrives. There is no interval and no cron:
              Microsoft pushes each message to the webhook as it lands. */}
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-brand-400" />
              <h3 className="text-lg font-semibold text-white">Incoming Email</h3>
            </div>

            <p className="text-sm text-slate-400">
              Microsoft 365 notifies XantyPSA the moment a message arrives, so tickets appear in
              seconds. Nothing polls the mailbox and there is no interval to tune.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-slate-400 space-y-1.5">
              <p className="text-slate-300 font-medium">Where the ticket lands</p>
              <p>1. Sender matches a contact&rsquo;s email &rarr; that contact&rsquo;s company.</p>
              <p>2. Sender&rsquo;s domain matches a company&rsquo;s email domains, or its website.</p>
              <p>3. Otherwise the catch-all company, so nothing is ever lost.</p>
            </div>

            <div className="pt-1">
              <Link href="/settings/email/processing" className="btn-secondary inline-flex">
                View connection status
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Google Workspace */}
      {provider === 'google' && (
        <div className="glass rounded-xl p-6 max-w-2xl">
          <h3 className="text-lg font-semibold text-white mb-2">Google Workspace</h3>
          <p className="text-sm text-slate-400 mb-4">Gmail API integration for sending and receiving emails.</p>
          <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-4">
            <p className="text-sm text-amber-300">Coming soon. In the meantime, you can use SMTP with Gmail:</p>
            <ul className="text-xs text-slate-400 mt-2 space-y-1 list-disc list-inside">
              <li>SMTP Host: <code className="bg-white/10 px-1 rounded">smtp.gmail.com</code></li>
              <li>Port: <code className="bg-white/10 px-1 rounded">587</code></li>
              <li>Username: your Gmail address</li>
              <li>Password: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Generate an App Password</a></li>
              <li>TLS: enabled</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
