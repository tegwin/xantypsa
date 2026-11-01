'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui';

interface Device {
  id: string;
  name: string;
  hostname: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  os: string;
  customerExternalId: string;
  alreadyImported: boolean;
}

export default function AssetImportPage() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as string;
  const typeName = type === 'ninja' ? 'NinjaOne' : type === 'datto' ? 'Datto RMM' : type;

  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [message, setMessage] = useState('');

  const fetchDevices = async () => {
    setFetching(true);
    setMessage('');
    try {
      const res = await fetch(`/api/integrations/${type}/devices`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        setFetched(true);
        // Auto-select devices that aren't already imported
        const notImported = (data.devices || [])
          .filter((d: Device) => !d.alreadyImported)
          .map((d: Device) => d.id);
        setSelected(new Set(notImported));
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Failed to fetch devices');
      }
    } catch {
      setMessage('Network error while fetching devices');
    } finally {
      setFetching(false);
    }
  };

  const toggleDevice = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const importable = devices.filter((d) => !d.alreadyImported);
    if (selected.size === importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map((d) => d.id)));
    }
  };

  const importSelected = async () => {
    setImporting(true);
    setMessage('');
    try {
      const toImport = devices.filter((d) => selected.has(d.id) && !d.alreadyImported);
      const res = await fetch(`/api/integrations/${type}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices: toImport }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Successfully imported ${data.imported} device(s). ${data.skipped} skipped (already imported).`);
        // Refresh the list
        await fetchDevices();
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || 'Import failed');
      }
    } catch {
      setMessage('Network error during import');
    } finally {
      setImporting(false);
    }
  };

  const importableCount = devices.filter((d) => !d.alreadyImported && selected.has(d.id)).length;

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={`Import Assets from ${typeName}`}
        subtitle="Fetch devices from your RMM and import them as assets"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/integrations')}
              className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
            >
              Back
            </button>
            <button
              onClick={fetchDevices}
              disabled={fetching}
              className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {fetching ? 'Fetching...' : 'Fetch Devices'}
            </button>
            {fetched && importableCount > 0 && (
              <button
                onClick={importSelected}
                disabled={importing}
                className="btn-primary text-sm px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Import Selected (${importableCount})`}
              </button>
            )}
          </div>
        }
      />

      {message && (
        <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${message.includes('Error') || message.includes('failed') || message.includes('Failed') ? 'bg-red-500/10 border border-red-500/20 text-red-300' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'}`}>
          {message}
        </div>
      )}

      {!fetched ? (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-slate-400 mb-4">Click &ldquo;Fetch Devices&rdquo; to load devices from {typeName}.</p>
          <p className="text-sm text-slate-500">Make sure your integration is configured and connected first.</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-slate-400">No devices found in {typeName}.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === devices.filter((d) => !d.alreadyImported).length && selected.size > 0}
                    onChange={toggleAll}
                    className="rounded border-white/20 bg-white/5"
                  />
                </th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">Name</th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">Hostname</th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">Type</th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">Manufacturer</th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">Model</th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">OS</th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr
                  key={device.id}
                  className={`border-b border-white/5 transition-colors ${device.alreadyImported ? 'opacity-50' : 'hover:bg-white/5'}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(device.id)}
                      onChange={() => toggleDevice(device.id)}
                      disabled={device.alreadyImported}
                      className="rounded border-white/20 bg-white/5 disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3 text-white text-sm font-medium">{device.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{device.hostname || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-white/10 text-slate-300 px-2 py-0.5 rounded capitalize">{device.type}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{device.manufacturer || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{device.model || '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{device.os || '-'}</td>
                  <td className="px-4 py-3">
                    {device.alreadyImported ? (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Imported</span>
                    ) : (
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">New</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-sm text-slate-400">
            <span>{devices.length} device(s) found, {devices.filter((d) => d.alreadyImported).length} already imported</span>
            <span>{importableCount} selected for import</span>
          </div>
        </div>
      )}
    </div>
  );
}
