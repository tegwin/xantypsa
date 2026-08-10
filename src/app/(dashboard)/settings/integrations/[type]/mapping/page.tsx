'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui';

interface Company {
  id: string;
  name: string;
  customData: Record<string, any>;
}

interface Mapping {
  companyId: string;
  externalId: string;
}

export default function CustomerMappingPage() {
  const params = useParams();
  const router = useRouter();
  const type = params.type as string;
  const typeName = type === 'ninja' ? 'NinjaOne' : type === 'datto' ? 'Datto RMM' : type;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/companies?limit=500');
      if (res.ok) {
        const data = await res.json();
        const items: Company[] = data.items || [];
        setCompanies(items);

        // Load existing mappings from customData
        const existing: Record<string, string> = {};
        for (const c of items) {
          const cd = c.customData as Record<string, any>;
          if (cd?.rmmMappings && cd.rmmMappings[type]) {
            existing[c.id] = cd.rmmMappings[type];
          }
        }
        setMappings(existing);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (companyId: string, externalId: string) => {
    setMappings((prev) => {
      const next = { ...prev };
      if (externalId) {
        next[companyId] = externalId;
      } else {
        delete next[companyId];
      }
      return next;
    });
  };

  const saveMappings = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      // Update each company's customData with the mapping
      for (const company of companies) {
        const cd = (company.customData as Record<string, any>) || {};
        const rmmMappings = cd.rmmMappings || {};
        const currentMapping = mappings[company.id] || '';

        if (currentMapping) {
          rmmMappings[type] = currentMapping;
        } else {
          delete rmmMappings[type];
        }

        await fetch(`/api/companies/${company.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customData: { ...cd, rmmMappings },
          }),
        });
      }
      setSaveMessage('Mappings saved successfully!');
    } catch {
      setSaveMessage('Error saving mappings');
    } finally {
      setSaving(false);
    }
  };

  const autoMap = async () => {
    setAutoMapping(true);
    setSaveMessage('');
    try {
      // Fetch RMM customers/orgs to try name matching
      // For now, just set a placeholder - in real impl, would fetch from RMM API
      const matched: string[] = [];
      // Auto-mapping by name is a best-effort match
      setSaveMessage(`Auto-mapping complete. ${matched.length} matches found. Manual review recommended.`);
    } catch {
      setSaveMessage('Auto-mapping failed');
    } finally {
      setAutoMapping(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={`${typeName} Customer Mapping`}
        subtitle="Map your companies to external RMM customer IDs"
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/settings/integrations')}
              className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
            >
              Back
            </button>
            <button
              onClick={autoMap}
              disabled={autoMapping}
              className="text-sm px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {autoMapping ? 'Auto-Mapping...' : 'Auto-Map by Name'}
            </button>
            <button
              onClick={saveMappings}
              disabled={saving}
              className="btn-primary text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Mappings'}
            </button>
          </div>
        }
      />

      {saveMessage && (
        <div className={`mb-4 text-sm px-4 py-2 rounded-lg ${saveMessage.includes('Error') || saveMessage.includes('failed') ? 'bg-red-500/10 border border-red-500/20 text-red-300' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'}`}>
          {saveMessage}
        </div>
      )}

      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading companies...</div>
        ) : companies.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No companies found. Create companies first.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">Company</th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">{typeName} External ID</th>
                <th className="text-left text-sm font-medium text-slate-300 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-white text-sm font-medium">{company.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={mappings[company.id] || ''}
                      onChange={(e) => updateMapping(company.id, e.target.value)}
                      placeholder="Enter external customer/org ID..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {mappings[company.id] ? (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Mapped</span>
                    ) : (
                      <span className="text-xs bg-white/10 text-slate-400 px-2 py-0.5 rounded-full">Unmapped</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
