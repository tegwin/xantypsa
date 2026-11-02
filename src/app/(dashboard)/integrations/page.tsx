'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui';

// ---------------------------------------------------------------------------
// Integration catalogue
// ---------------------------------------------------------------------------

interface IntegrationDef {
  key: string;
  name: string;
  description: string;
  apiDocs?: string;
  hasMcp: boolean;
  mcpInfo?: string;
  isRmm?: boolean;
  comingSoon?: boolean;
}

interface CategoryDef {
  name: string;
  description: string;
  integrations: IntegrationDef[];
}

// Vendor mark shipped under public/integrations, by integration key. The file
// extension varies because the marks come from different places, so the name is
// spelled out rather than guessed. A key missing here falls back to a monogram
// tile in the vendor's brand colour, as does a file that fails to load.
const LOGO_FILES: Record<string, string> = {
  ninja: 'ninja.png',
  datto: 'datto.svg',
  hudu: 'hudu.ico',
  xero: 'xero.svg',
  quickbooks: 'quickbooks.svg',
  stripe: 'stripe.svg',
  halopsa: 'halopsa.png',
  autotask: 'autotask.png',
  connectwise: 'connectwise.png',
  microsoft365: 'microsoft365.ico',
  google: 'google.svg',
  slack: 'slack.svg',
  teams: 'teams.ico',
};

const BRAND_COLOURS: Record<string, string> = {
  ninja: '#2a6ebb',
  datto: '#0066a1',
  hudu: '#4f46e5',
  xero: '#13b5ea',
  quickbooks: '#2ca01c',
  stripe: '#635bff',
  halopsa: '#f26522',
  autotask: '#e31e24',
  connectwise: '#1f3a93',
  microsoft365: '#d83b01',
  google: '#4285f4',
  slack: '#4a154b',
  teams: '#4b53bc',
};

function IntegrationLogo({ intKey, name }: { intKey: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const file = LOGO_FILES[intKey];

  if (!file || failed) {
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{ backgroundColor: BRAND_COLOURS[intKey] ?? '#334155' }}
        aria-hidden="true"
      >
        {name.charAt(0)}
      </div>
    );
  }

  return (
    // A plain <img> rather than next/image: these are small static marks and we
    // rely on onError to fall back to the monogram.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/integrations/${file}`}
      alt=""
      width={36}
      height={36}
      className="w-9 h-9 rounded-lg object-contain bg-white/90 p-1 shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

// Each PSA authenticates differently, so the dialog asks for what that vendor
// actually needs rather than a generic four boxes that are mostly ignored.
const PSA_FIELDS: Record<string, { key: string; label: string; secret?: boolean; placeholder?: string }[]> = {
  halopsa: [
    { key: 'apiUrl', label: 'Halo URL', placeholder: 'https://yourco.halopsa.com' },
    { key: 'clientId', label: 'Client ID' },
    { key: 'clientSecret', label: 'Client secret', secret: true },
  ],
  autotask: [
    { key: 'apiUrl', label: 'API zone URL', placeholder: 'https://webservices16.autotask.net' },
    { key: 'apiIntegrationCode', label: 'API integration code' },
    { key: 'userName', label: 'API user name' },
    { key: 'secret', label: 'API secret', secret: true },
  ],
  connectwise: [
    { key: 'apiUrl', label: 'Site URL', placeholder: 'https://api-eu.myconnectwise.net' },
    { key: 'companyId', label: 'Company ID' },
    { key: 'publicKey', label: 'Public key' },
    { key: 'privateKey', label: 'Private key', secret: true },
    { key: 'clientId', label: 'Client ID' },
  ],
};

const GENERIC_FIELDS = [
  { key: 'apiKey', label: 'API key', secret: true },
  { key: 'apiUrl', label: 'API URL', placeholder: 'https://...' },
  { key: 'clientId', label: 'Client ID (if required)' },
  { key: 'clientSecret', label: 'Client secret (if required)', secret: true },
];

const INTEGRATION_CATEGORIES: CategoryDef[] = [
  {
    name: 'RMM Tools',
    description: 'Remote Monitoring & Management',
    integrations: [
      { key: 'ninja', name: 'NinjaOne (NinjaRMM)', description: 'Sync assets, monitor devices', apiDocs: 'https://app.ninjarmm.com/apidocs/', hasMcp: true, mcpInfo: 'ninja-mcp server available', isRmm: true },
      { key: 'datto', name: 'Datto RMM', description: 'Device monitoring and asset sync', apiDocs: 'https://rmm-api-docs.datto.com/', hasMcp: false, isRmm: true },
    ],
  },
  {
    name: 'Documentation',
    description: 'IT Documentation & Knowledge Base',
    integrations: [
      { key: 'hudu', name: 'Hudu', description: 'Sync customers, import KB articles for tickets', apiDocs: 'https://hudu.com/support/rest-api', hasMcp: false },
    ],
  },
  {
    name: 'Accounting & Billing',
    description: 'Invoicing and financial management',
    integrations: [
      { key: 'xero', name: 'Xero', description: 'Create invoices, sync customers', hasMcp: false },
      { key: 'quickbooks', name: 'QuickBooks Online', description: 'Invoice and payment sync', hasMcp: false },
      { key: 'stripe', name: 'Stripe', description: 'Payment processing', hasMcp: false },
    ],
  },
  {
    name: 'PSA Tools',
    description: 'Professional Services Automation',
    integrations: [
      { key: 'halopsa', name: 'HaloPSA', description: 'Ticket and customer sync', hasMcp: false },
      { key: 'autotask', name: 'Datto Autotask', description: 'PSA data migration', hasMcp: false },
      { key: 'connectwise', name: 'ConnectWise Manage', description: 'Ticket and billing sync', hasMcp: false },
    ],
  },
  {
    name: 'Communication',
    description: 'Team collaboration and notifications',
    integrations: [
      { key: 'microsoft365', name: 'Microsoft 365', description: 'Email sending and calendar', hasMcp: false },
      { key: 'google', name: 'Google Workspace', description: 'Gmail and calendar', hasMcp: false },
      { key: 'slack', name: 'Slack', description: 'Notifications and alerts', hasMcp: false },
      { key: 'teams', name: 'Microsoft Teams', description: 'Notifications and alerts', hasMcp: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationRecord {
  id: string;
  type: string;
  name: string;
  config: Record<string, string>;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Configure Modal
// ---------------------------------------------------------------------------

function ConfigureModal({
  integration,
  record,
  onClose,
  onSaved,
}: {
  integration: IntegrationDef;
  record: IntegrationRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fields = PSA_FIELDS[integration.key] || GENERIC_FIELDS;
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = record?.config?.[f.key] || '';
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/integrations/${integration.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: integration.name, config, isActive: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult({ ok: false, message: data.error || 'Could not save.' });
        return;
      }
      onSaved();
    } catch {
      setTestResult({ ok: false, message: 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // PSAs have a real test; everything else still falls back to the RMM
      // device call, which is the only other thing that proves anything.
      const isPsa = !!PSA_FIELDS[integration.key];
      const res = isPsa
        ? await fetch(`/api/integrations/${integration.key}/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config }),
          })
        : await fetch(`/api/integrations/${integration.key}/devices`);

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestResult({ ok: true, message: data.message || 'Connection successful.' });
      } else {
        setTestResult({ ok: false, message: data.message || data.error || 'Connection failed.' });
      }
    } catch {
      setTestResult({ ok: false, message: 'Network error' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-xl w-full max-w-lg p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-white">{integration.name}</h2>
            <p className="text-sm text-slate-400">{integration.description}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>

        {integration.hasMcp && (
          <div className="mb-4 flex items-center gap-2 text-sm bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-2 rounded-lg">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-400" />
            MCP: {integration.mcpInfo}
          </div>
        )}

        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`cfg-${f.key}`} className="block text-sm text-slate-300 mb-1">
                {f.label}
              </label>
              <input
                id={`cfg-${f.key}`}
                type={f.secret ? 'password' : 'text'}
                value={config[f.key] || ''}
                onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
                placeholder={f.placeholder || ''}
              />
            </div>
          ))}
        </div>

        {testResult && (
          <div className={`mt-4 text-sm px-3 py-2 rounded-lg ${testResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-red-500/10 border border-red-500/20 text-red-300'}`}>
            {testResult.message}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            {integration.apiDocs && (
              <a
                href={integration.apiDocs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                API Docs
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={testConnection}
              disabled={testing}
              className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* RMM-specific links */}
        {integration.isRmm && record?.isActive && (
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-4">
            <a
              href={`/integrations/${integration.key}/mapping`}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Customer Mapping
            </a>
            <a
              href={`/integrations/${integration.key}/import`}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Import Assets
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsIntegrationsPage() {
  const [records, setRecords] = useState<IntegrationRecord[]>([]);
  const [configuring, setConfiguring] = useState<IntegrationDef | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      // Fetch all known integration types
      const types = INTEGRATION_CATEGORIES.flatMap((c) => c.integrations.map((i) => i.key));
      const results: IntegrationRecord[] = [];
      await Promise.all(
        types.map(async (type) => {
          const res = await fetch(`/api/integrations/${type}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.id) results.push(data);
          }
        })
      );
      setRecords(results);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const getRecord = (key: string) => records.find((r) => r.type === key) || null;

  const getStatus = (int: IntegrationDef): 'connected' | 'available' | 'coming_soon' => {
    if (int.comingSoon) return 'coming_soon';
    const rec = getRecord(int.key);
    if (rec?.isActive) return 'connected';
    return 'available';
  };

  const statusBadge = (status: 'connected' | 'available' | 'coming_soon') => {
    switch (status) {
      case 'connected':
        return <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">Connected</span>;
      case 'available':
        return <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">Available</span>;
      case 'coming_soon':
        return <span className="text-xs bg-white/10 text-slate-400 px-2 py-0.5 rounded-full font-medium">Coming Soon</span>;
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Integrations" subtitle="Connect third-party services and tools" />

      {configuring && (
        <ConfigureModal
          integration={configuring}
          record={getRecord(configuring.key)}
          onClose={() => setConfiguring(null)}
          onSaved={() => {
            setConfiguring(null);
            fetchRecords();
          }}
        />
      )}

      <div className="space-y-8">
        {INTEGRATION_CATEGORIES.map((category) => (
          <div key={category.name}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-white">{category.name}</h2>
              <p className="text-sm text-slate-400">{category.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.integrations.map((int) => {
                const status = getStatus(int);
                return (
                  <div key={int.key} className="glass rounded-xl p-6 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between mb-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <IntegrationLogo intKey={int.key} name={int.name} />
                        <h3 className="text-white font-semibold truncate">{int.name}</h3>
                      </div>
                      {statusBadge(status)}
                    </div>
                    <p className="text-sm text-slate-400 mb-1">{int.description}</p>

                    {int.hasMcp && (
                      <div className="flex items-center gap-1.5 mb-3 mt-2">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span className="text-xs text-purple-300">MCP Available</span>
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => !int.comingSoon && setConfiguring(int)}
                        disabled={!!int.comingSoon}
                        className={`text-sm flex-1 py-2 rounded-lg transition-colors ${
                          int.comingSoon
                            ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                            : status === 'connected'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                        }`}
                      >
                        {int.comingSoon ? 'Coming Soon' : 'Configure'}
                      </button>

                      {int.isRmm && status === 'connected' && (
                        <>
                          <a
                            href={`/integrations/${int.key}/mapping`}
                            className="text-sm py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                            title="Customer Mapping"
                          >
                            Map
                          </a>
                          <a
                            href={`/integrations/${int.key}/import`}
                            className="text-sm py-2 px-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                            title="Import Assets"
                          >
                            Import
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
