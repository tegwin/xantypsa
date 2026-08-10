'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Button, LoadingSpinner } from '@/components/ui';
import { DEFAULT_ENTITY_NAMES } from '@/lib/entityNames';
import { useEntityNames } from '@/hooks/useEntityNames';
import { Save, RotateCcw, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditRow {
  singular: string;
  plural: string;
  dirty: boolean;
}

export default function EntityNamesPage() {
  const { getName, updateName, loading, overrides } = useEntityNames();
  const [rows, setRows] = useState<Record<string, EditRow>>({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Initialize rows from defaults + overrides
  useEffect(() => {
    if (!loading) {
      const initial: Record<string, EditRow> = {};
      Object.entries(DEFAULT_ENTITY_NAMES).forEach(([key, def]) => {
        initial[key] = {
          singular: overrides[key]?.singular || def.singular,
          plural: overrides[key]?.plural || def.plural,
          dirty: false,
        };
      });
      setRows(initial);
    }
  }, [loading, overrides]);

  const handleChange = (entityType: string, field: 'singular' | 'plural', value: string) => {
    setRows(prev => ({
      ...prev,
      [entityType]: {
        ...prev[entityType],
        [field]: value,
        dirty: true,
      },
    }));
  };

  const handleReset = (entityType: string) => {
    const def = DEFAULT_ENTITY_NAMES[entityType];
    setRows(prev => ({
      ...prev,
      [entityType]: {
        singular: def.singular,
        plural: def.plural,
        dirty: true,
      },
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const dirtyRows = Object.entries(rows).filter(([_, row]) => row.dirty);
      for (const [entityType, row] of dirtyRows) {
        await updateName(entityType, row.singular, row.plural);
      }
      setRows(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          updated[key] = { ...updated[key], dirty: false };
        });
        return updated;
      });
      toast.success(`Saved ${dirtyRows.length} entity name${dirtyRows.length !== 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRow = async (entityType: string) => {
    const row = rows[entityType];
    if (!row) return;
    try {
      await updateName(entityType, row.singular, row.plural);
      setRows(prev => ({
        ...prev,
        [entityType]: { ...prev[entityType], dirty: false },
      }));
      toast.success(`Saved "${row.singular}" / "${row.plural}"`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    }
  };

  const hasDirtyRows = Object.values(rows).some(r => r.dirty);

  if (loading) return <LoadingSpinner />;

  // Simulated sidebar preview
  const previewItems = [
    { key: 'contact', icon: 'Users' },
    { key: 'company', icon: 'Building2' },
    { key: 'opportunity', icon: 'TrendingUp' },
    { key: 'ticket', icon: 'LifeBuoy' },
    { key: 'contract', icon: 'FileText' },
    { key: 'quote', icon: 'Receipt' },
    { key: 'invoice', icon: 'CreditCard' },
    { key: 'project', icon: 'FolderKanban' },
    { key: 'product', icon: 'Package' },
  ];

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Entity Names" description="Customize how entities are named throughout the system"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? 'Hide Preview' : 'Preview'}
            </Button>
            <Button icon={<Save className="h-4 w-4" />} loading={saving} disabled={!hasDirtyRows} onClick={handleSaveAll}>
              Save All Changes
            </Button>
          </div>
        }
      />

      <div className={`grid ${showPreview ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'} gap-6`}>
        {/* Main Table */}
        <div className={showPreview ? 'lg:col-span-2' : ''}>
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-surface-400">
                  <th className="text-left p-4 font-medium">Entity</th>
                  <th className="text-left p-4 font-medium">Default Name</th>
                  <th className="text-left p-4 font-medium">Singular Override</th>
                  <th className="text-left p-4 font-medium">Plural Override</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(DEFAULT_ENTITY_NAMES).map(([entityType, def]) => {
                  const row = rows[entityType];
                  if (!row) return null;
                  const isCustomized = row.singular !== def.singular || row.plural !== def.plural;

                  return (
                    <tr key={entityType} className="border-b border-white/5 hover:bg-surface-800/30 transition-colors">
                      <td className="p-4">
                        <span className="text-surface-300 font-mono text-xs bg-surface-800 px-2 py-0.5 rounded">{entityType}</span>
                      </td>
                      <td className="p-4 text-surface-400">
                        {def.singular} / {def.plural}
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={row.singular}
                          onChange={(e) => handleChange(entityType, 'singular', e.target.value)}
                          className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={row.plural}
                          onChange={(e) => handleChange(entityType, 'plural', e.target.value)}
                          className="w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                        />
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.dirty && (
                            <Button size="xs" variant="primary" onClick={() => handleSaveRow(entityType)}>Save</Button>
                          )}
                          {isCustomized && (
                            <Button size="xs" variant="ghost" icon={<RotateCcw className="h-3 w-3" />}
                              onClick={() => handleReset(entityType)} title="Reset to default" />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview Sidebar */}
        {showPreview && (
          <div>
            <div className="glass rounded-xl p-4">
              <h3 className="text-white font-semibold mb-4 text-sm">Sidebar Preview</h3>
              <div className="space-y-1 bg-surface-900 rounded-lg p-3">
                <p className="text-xs text-surface-500 uppercase tracking-wider px-2 mb-2">Navigation</p>
                {previewItems.map(item => {
                  const row = rows[item.key];
                  const label = row?.plural || DEFAULT_ENTITY_NAMES[item.key]?.plural || item.key;
                  return (
                    <div key={item.key} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-surface-400 hover:bg-surface-800 transition-colors">
                      <div className="w-4 h-4 rounded bg-surface-700" />
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-surface-500 mt-3">This preview shows how entity names would appear in the sidebar navigation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
