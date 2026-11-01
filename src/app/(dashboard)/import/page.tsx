'use client';

import { useState, useRef } from 'react';
import { PageHeader } from '@/components/ui';
import toast from 'react-hot-toast';

type EntityType = 'companies' | 'contacts' | 'products' | 'contracts';

const ENTITY_CONFIG: Record<EntityType, { label: string; endpoint: string; fields: { key: string; label: string; required?: boolean }[] }> = {
  companies: {
    label: 'Companies',
    endpoint: '/api/companies/bulk',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'website', label: 'Website' },
      { key: 'address1', label: 'Address 1' },
      { key: 'address2', label: 'Address 2' },
      { key: 'address3', label: 'Address 3' },
      { key: 'city', label: 'City' },
      { key: 'postcode', label: 'Postcode' },
      { key: 'country', label: 'Country' },
      { key: 'industry', label: 'Industry' },
      { key: 'type', label: 'Type' },
    ],
  },
  contacts: {
    label: 'Contacts',
    endpoint: '/api/contacts/bulk',
    fields: [
      { key: 'firstName', label: 'First Name', required: true },
      { key: 'lastName', label: 'Last Name', required: true },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'jobTitle', label: 'Job Title' },
      { key: 'department', label: 'Department' },
      { key: 'companyId', label: 'Company ID' },
    ],
  },
  products: {
    label: 'Products',
    endpoint: '/api/products/bulk',
    fields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'description', label: 'Description' },
      { key: 'sku', label: 'SKU' },
      { key: 'type', label: 'Type' },
      { key: 'unitPrice', label: 'Unit Price' },
      { key: 'cost', label: 'Cost' },
      { key: 'taxRate', label: 'Tax Rate' },
      { key: 'unit', label: 'Unit' },
      { key: 'billingType', label: 'Billing Type' },
    ],
  },
  contracts: {
    label: 'Contracts',
    endpoint: '/api/contracts/bulk',
    fields: [
      { key: 'companyId', label: 'Company ID', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'type', label: 'Type', required: true },
      { key: 'startDate', label: 'Start Date', required: true },
      { key: 'status', label: 'Status' },
      { key: 'endDate', label: 'End Date' },
      { key: 'value', label: 'Value' },
      { key: 'billingCycle', label: 'Billing Cycle' },
    ],
  },
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current.trim());
        if (row.some(c => c !== '')) rows.push(row);
        row = [];
        current = '';
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  // Last row
  row.push(current.trim());
  if (row.some(c => c !== '')) rows.push(row);

  return rows;
}

function downloadTemplate(entityType: EntityType) {
  const config = ENTITY_CONFIG[entityType];
  const headers = config.fields.map(f => f.key);
  const csv = headers.join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${entityType}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportPage() {
  const [entityType, setEntityType] = useState<EntityType>('companies');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: any[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const config = ENTITY_CONFIG[entityType];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        toast.error('CSV must have a header row and at least one data row');
        return;
      }

      const headers = parsed[0];
      const dataRows = parsed.slice(1);
      setCsvHeaders(headers);
      setCsvRows(dataRows);

      // Auto-map columns by header name match
      const autoMap: Record<number, string> = {};
      headers.forEach((h, i) => {
        const normalized = h.toLowerCase().replace(/[\s_-]/g, '');
        const match = config.fields.find(f => f.key.toLowerCase() === normalized || f.label.toLowerCase().replace(/[\s_-]/g, '') === normalized);
        if (match) autoMap[i] = match.key;
      });
      setColumnMap(autoMap);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setResult(null);

    // Map rows to objects
    const items = csvRows.map(row => {
      const obj: Record<string, string> = {};
      Object.entries(columnMap).forEach(([colIdx, fieldKey]) => {
        const val = row[parseInt(colIdx)];
        if (val !== undefined && val !== '') obj[fieldKey] = val;
      });
      return obj;
    }).filter(obj => Object.keys(obj).length > 0);

    if (items.length === 0) {
      toast.error('No valid data to import');
      setImporting(false);
      return;
    }

    // Batch in groups of 100
    let totalCreated = 0;
    const allErrors: any[] = [];

    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);
      try {
        const res = await fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch }),
        });
        const data = await res.json();
        if (data.error) {
          allErrors.push({ batch: i, error: data.error });
        } else {
          totalCreated += data.created || 0;
          if (data.errors?.length) allErrors.push(...data.errors.map((e: any) => ({ ...e, index: (e.index || 0) + i })));
        }
      } catch (err: any) {
        allErrors.push({ batch: i, error: err.message });
      }
    }

    setResult({ created: totalCreated, errors: allErrors });
    if (totalCreated > 0) toast.success(`Successfully imported ${totalCreated} ${config.label.toLowerCase()}`);
    if (allErrors.length > 0) toast.error(`${allErrors.length} error(s) during import`);
    setImporting(false);
  };

  const resetFile = () => {
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMap({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Import Data" subtitle="Bulk import data from CSV files" />

      {/* Entity type tabs */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(ENTITY_CONFIG) as EntityType[]).map(key => (
          <button
            key={key}
            onClick={() => { setEntityType(key); resetFile(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              entityType === key
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-surface-800'
            }`}
          >
            {ENTITY_CONFIG[key].label}
          </button>
        ))}
      </div>

      <div className="glass rounded-xl p-6 max-w-4xl space-y-6">
        {/* Step 1: Download template + Upload */}
        <div className="flex items-center gap-4">
          <button onClick={() => downloadTemplate(entityType)} className="btn-secondary text-sm">
            Download Template
          </button>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:cursor-pointer"
            />
          </div>
        </div>

        {/* Step 2: Preview + Column mapping */}
        {csvHeaders.length > 0 && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Column Mapping</h3>
              <p className="text-xs text-slate-400 mb-3">Map each CSV column to a field. Required fields are marked with *.</p>
              <div className="grid grid-cols-2 gap-3">
                {csvHeaders.map((header, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-slate-300 w-32 truncate" title={header}>{header}</span>
                    <select
                      value={columnMap[i] || ''}
                      onChange={e => setColumnMap({ ...columnMap, [i]: e.target.value })}
                      className="flex-1 text-sm"
                    >
                      <option value="">-- Skip --</option>
                      {config.fields.map(f => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Preview (first 5 rows)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700">
                      {csvHeaders.map((h, i) => (
                        <th key={i} className="text-left text-slate-400 px-2 py-1 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, ri) => (
                      <tr key={ri} className="border-b border-surface-700/50">
                        {csvHeaders.map((_, ci) => (
                          <td key={ci} className="text-slate-300 px-2 py-1 max-w-[200px] truncate">{row[ci] || ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-2">{csvRows.length} row(s) found in CSV</p>
            </div>

            {/* Import button */}
            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={importing || Object.keys(columnMap).length === 0}
                className="btn-primary"
              >
                {importing ? 'Importing...' : `Import ${csvRows.length} ${config.label}`}
              </button>
              <button onClick={resetFile} className="btn-secondary">Clear</button>
            </div>
          </>
        )}

        {/* Results */}
        {result && (
          <div className="glass rounded-lg p-4 space-y-2">
            <p className="text-sm text-white font-medium">
              Import Result: {result.created} created, {result.errors.length} error(s)
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-400">
                    Row {err.index !== undefined ? err.index + 1 : '?'}: {err.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
