'use client';

import { useState, useRef } from 'react';
import { useApi, apiPost } from '@/hooks/useApi';
import {
  PageHeader, DataTable, StatusBadge, Modal, Pagination, EmptyState, LoadingSpinner, Badge,
} from '@/components/ui';
import { useRouter } from 'next/navigation';
import { Monitor, Plus, Upload, Search, X, AlertCircle, CheckCircle2 } from 'lucide-react';

const ASSET_TYPES = [
  { key: '', label: 'All' },
  { key: 'device', label: 'Device' },
  { key: 'server', label: 'Server' },
  { key: 'network', label: 'Network' },
  { key: 'software', label: 'Software' },
  { key: 'peripheral', label: 'Peripheral' },
  { key: 'other', label: 'Other' },
];

const ASSET_STATUSES = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'retired', label: 'Retired' },
  { key: 'in_repair', label: 'In Repair' },
  { key: 'lost', label: 'Lost' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  inactive: 'bg-slate-500/20 text-slate-400',
  retired: 'bg-red-500/20 text-red-400',
  in_repair: 'bg-amber-500/20 text-amber-400',
  lost: 'bg-red-500/20 text-red-300',
};

const TYPE_COLORS: Record<string, string> = {
  device: 'bg-blue-500/20 text-blue-400',
  server: 'bg-purple-500/20 text-purple-400',
  network: 'bg-cyan-500/20 text-cyan-400',
  software: 'bg-emerald-500/20 text-emerald-400',
  peripheral: 'bg-amber-500/20 text-amber-400',
  other: 'bg-slate-500/20 text-slate-400',
};

const emptyForm = {
  name: '',
  type: 'device',
  companyId: '',
  siteId: '',
  contactId: '',
  assetTag: '',
  serialNumber: '',
  manufacturer: '',
  model: '',
  status: 'active',
  purchaseDate: '',
  warrantyExpiry: '',
  notes: '',
};

export default function AssetsListPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const queryParts = [`page=${page}`, `limit=25`];
  if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
  if (typeFilter) queryParts.push(`type=${typeFilter}`);
  if (statusFilter) queryParts.push(`status=${statusFilter}`);

  const { data, loading, refetch } = useApi<any>(`/api/assets?${queryParts.join('&')}`);
  const { data: companiesData } = useApi<any>('/api/companies?limit=500');

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;
  const companies = companiesData?.items || [];

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    const payload: any = { ...form };
    if (!payload.companyId) delete payload.companyId;
    if (!payload.siteId) delete payload.siteId;
    if (!payload.contactId) delete payload.contactId;
    if (!payload.purchaseDate) delete payload.purchaseDate;
    if (!payload.warrantyExpiry) delete payload.warrantyExpiry;
    if (!payload.notes) delete payload.notes;
    const res = await apiPost('/api/assets', payload);
    setSaving(false);
    if (res) {
      setShowCreate(false);
      setForm(emptyForm);
      refetch();
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Assets" subtitle="Manage hardware, software, and configuration items">
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Asset
          </button>
        </div>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        {/* Search + Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, asset tag, serial number..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="w-40"
          >
            {ASSET_STATUSES.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 overflow-x-auto">
          {ASSET_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => { setTypeFilter(t.key); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                typeFilter === t.key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : !items.length ? (
          <EmptyState
            icon={<Monitor className="w-12 h-12" />}
            title="No assets found"
            description="Add your first asset or import from CSV"
            actionLabel="Add Asset"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          <>
            <DataTable
              columns={[
                {
                  key: 'name',
                  label: 'Name',
                  render: (r: any) => (
                    <div>
                      <div className="font-medium text-white">{r.name}</div>
                      {r.manufacturer && (
                        <div className="text-xs text-slate-500">{r.manufacturer}{r.model ? ` ${r.model}` : ''}</div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'assetTag',
                  label: 'Asset Tag',
                  render: (r: any) => (
                    <span className="text-slate-400 font-mono text-xs">{r.assetTag || '\u2014'}</span>
                  ),
                },
                {
                  key: 'serialNumber',
                  label: 'Serial Number',
                  render: (r: any) => (
                    <span className="text-slate-400 font-mono text-xs">{r.serialNumber || '\u2014'}</span>
                  ),
                },
                {
                  key: 'type',
                  label: 'Type',
                  render: (r: any) => (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[r.type] || TYPE_COLORS.other}`}>
                      {r.type}
                    </span>
                  ),
                },
                {
                  key: 'company',
                  label: 'Company',
                  render: (r: any) => (
                    <span className="text-slate-300 text-sm">{r.company?.name || '\u2014'}</span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r: any) => (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || STATUS_COLORS.inactive}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  ),
                },
              ]}
              data={items}
              onRowClick={(r: any) => router.push(`/assets/${r.id}`)}
            />
            {pages > 1 && (
              <div className="mt-4">
                <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Add Asset" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full" placeholder="e.g. Dell Latitude 5520" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full">
                  <option value="device">Device</option>
                  <option value="server">Server</option>
                  <option value="network">Network</option>
                  <option value="software">Software</option>
                  <option value="peripheral">Peripheral</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="retired">Retired</option>
                  <option value="in_repair">In Repair</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Company</label>
              <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className="w-full">
                <option value="">None</option>
                {companies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Asset Tag</label>
                <input value={form.assetTag} onChange={e => setForm({ ...form, assetTag: e.target.value })} className="w-full" placeholder="e.g. AST-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Serial Number</label>
                <input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className="w-full" placeholder="e.g. SN123456" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Manufacturer</label>
                <input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} className="w-full" placeholder="e.g. Dell" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Model</label>
                <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="w-full" placeholder="e.g. Latitude 5520" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Purchase Date</label>
                <input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Warranty Expiry</label>
                <input type="date" value={form.warrantyExpiry} onChange={e => setForm({ ...form, warrantyExpiry: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full" placeholder="Additional notes..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCreate} className="btn-primary" disabled={!form.name || saving}>
                {saving ? 'Creating...' : 'Add Asset'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import CSV Modal */}
      {showImport && (
        <ImportCsvModal onClose={() => setShowImport(false)} onSuccess={() => { setShowImport(false); refetch(); }} companies={companies} />
      )}
    </div>
  );
}

function ImportCsvModal({ onClose, onSuccess, companies }: { onClose: () => void; onSuccess: () => void; companies: any[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const FIELDS = [
    { key: 'name', label: 'Name (required)' },
    { key: 'assetTag', label: 'Asset Tag' },
    { key: 'serialNumber', label: 'Serial Number' },
    { key: 'type', label: 'Type' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'model', label: 'Model' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes' },
  ];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
      if (lines.length < 2) return;
      const hdrs = lines[0];
      setHeaders(hdrs);
      setCsvData(lines.slice(1).filter(l => l.some(c => c)));
      // Auto-map columns
      const autoMap: Record<string, string> = {};
      FIELDS.forEach(f => {
        const match = hdrs.findIndex(h => h.toLowerCase().replace(/[^a-z]/g, '') === f.key.toLowerCase());
        if (match >= 0) autoMap[f.key] = String(match);
      });
      setMapping(autoMap);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!mapping.name) return;
    setImporting(true);
    const items = csvData.map(row => {
      const item: any = {};
      Object.entries(mapping).forEach(([field, colIdx]) => {
        const val = row[parseInt(colIdx)];
        if (val) item[field] = val;
      });
      return item;
    }).filter(i => i.name);

    try {
      const res = await apiPost('/api/assets/bulk', { items });
      setResult(res);
      if (res && (!res.errors || res.errors.length === 0)) {
        setTimeout(onSuccess, 1500);
      }
    } catch {
      // error handled by apiPost
    }
    setImporting(false);
  };

  return (
    <Modal title="Import Assets from CSV" onClose={onClose}>
      <div className="space-y-4">
        {!headers.length ? (
          <div>
            <p className="text-sm text-slate-400 mb-3">Upload a CSV file with asset data. The first row should contain column headers.</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="w-full" />
          </div>
        ) : result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{result.created} assets imported</span>
            </div>
            {result.errors?.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{result.errors.length} errors</span>
                </div>
                <div className="max-h-32 overflow-y-auto text-xs text-slate-400 bg-white/5 rounded p-2">
                  {result.errors.map((err: any, i: number) => (
                    <div key={i}>Row {err.index + 1}: {err.error}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={onClose} className="btn-primary">Done</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400">
              Found {csvData.length} rows. Map columns to asset fields below.
            </p>

            <div className="space-y-3">
              {FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <span className="text-sm text-slate-300 w-40 flex-shrink-0">{f.label}</span>
                  <select
                    value={mapping[f.key] || ''}
                    onChange={e => setMapping({ ...mapping, [f.key]: e.target.value })}
                    className="flex-1"
                  >
                    <option value="">-- Skip --</option>
                    {headers.map((h, i) => (
                      <option key={i} value={String(i)}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {csvData.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Preview (first 3 rows):</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {headers.map((h, i) => (
                          <th key={i} className="text-left text-slate-500 px-2 py-1 border-b border-white/5">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="text-slate-400 px-2 py-1 border-b border-white/5">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary">Cancel</button>
              <button onClick={handleImport} className="btn-primary" disabled={!mapping.name || importing}>
                {importing ? 'Importing...' : `Import ${csvData.length} Assets`}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
