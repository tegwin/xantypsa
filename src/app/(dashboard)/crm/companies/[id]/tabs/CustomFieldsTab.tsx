'use client';

import { useState, useEffect } from 'react';
import { useApi, apiPatch } from '@/hooks/useApi';
import { Save } from 'lucide-react';
import Link from 'next/link';

interface CustomFieldsTabProps {
  company: any;
  onRefresh: () => void;
}

export default function CustomFieldsTab({ company, onRefresh }: CustomFieldsTabProps) {
  const { data: fieldsData, loading } = useApi<any>('/api/custom-fields?entityType=company');
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const fields = fieldsData?.items || [];

  useEffect(() => {
    if (company.customData) {
      try {
        const parsed = typeof company.customData === 'string' ? JSON.parse(company.customData) : company.customData;
        setValues(parsed);
      } catch {
        setValues({});
      }
    }
  }, [company.customData]);

  const handleSave = async () => {
    setSaving(true);
    await apiPatch(`/api/companies/${company.id}`, { customData: values });
    setSaving(false);
    onRefresh();
  };

  const updateValue = (fieldKey: string, value: any) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }));
  };

  const renderField = (field: any) => {
    const value = values[field.fieldKey] ?? '';
    const commonClass = 'w-full';

    switch (field.fieldType) {
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
        return (
          <input
            type={field.fieldType === 'email' ? 'email' : field.fieldType === 'url' ? 'url' : 'text'}
            value={value}
            onChange={e => updateValue(field.fieldKey, e.target.value)}
            className={commonClass}
            placeholder={`Enter ${field.name.toLowerCase()}`}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={e => updateValue(field.fieldKey, e.target.value ? Number(e.target.value) : '')}
            className={commonClass}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={e => updateValue(field.fieldKey, e.target.value)}
            className={commonClass}
          />
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={e => updateValue(field.fieldKey, e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-slate-300">{field.name}</span>
          </label>
        );
      case 'select':
      case 'dropdown':
        const options = Array.isArray(field.options) ? field.options : [];
        return (
          <select value={value} onChange={e => updateValue(field.fieldKey, e.target.value)} className={commonClass}>
            <option value="">Select...</option>
            {options.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={e => updateValue(field.fieldKey, e.target.value)}
            className={commonClass}
          />
        );
    }
  };

  if (loading) return <div className="text-center py-8 text-slate-400">Loading custom fields...</div>;

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">Custom Fields</h3>
        <div className="flex items-center gap-2">
          <Link href="/settings/custom-fields" className="text-xs text-brand-400 hover:text-brand-300">Manage fields →</Link>
          {fields.length > 0 && (
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-1.5 text-sm">
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {fields.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field: any) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                {field.name} {field.required && <span className="text-red-400">*</span>}
              </label>
              {renderField(field)}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-slate-500 mb-2">No custom fields defined for companies</p>
          <Link href="/settings/custom-fields" className="text-sm text-brand-400 hover:text-brand-300">
            Configure custom fields →
          </Link>
        </div>
      )}
    </div>
  );
}
