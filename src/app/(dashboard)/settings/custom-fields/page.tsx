'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/useApi';
import {
  PageHeader,
  Tabs,
  Modal,
  Button,
  Input,
  Select,
  Textarea,
  DataTable,
  EmptyState,
  LoadingSpinner,
  Badge,
  ConfirmDialog,
} from '@/components/ui';
import { Settings2, Plus, Pencil, Trash2 } from 'lucide-react';

const ENTITY_TYPES = [
  { id: 'company', label: 'Company' },
  { id: 'contact', label: 'Contact' },
  { id: 'site', label: 'Site' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'asset', label: 'Asset' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

interface CustomField {
  id: string;
  name: string;
  fieldKey: string;
  fieldType: string;
  entityType: string;
  options?: string[];
  required: boolean;
  sortOrder: number;
  createdAt: string;
}

const emptyForm = {
  name: '',
  fieldKey: '',
  fieldType: 'text',
  options: '',
  required: false,
  sortOrder: 0,
};

function generateFieldKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export default function CustomFieldsPage() {
  const [activeTab, setActiveTab] = useState('company');
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [deleteField, setDeleteField] = useState<CustomField | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, loading, refetch } = useApi<{ fields: CustomField[] }>(
    `/api/custom-fields?entityType=${activeTab}`
  );

  const fields = (data as any)?.items || [];

  const openAdd = () => {
    setEditingField(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (field: CustomField) => {
    setEditingField(field);
    setForm({
      name: field.name,
      fieldKey: field.fieldKey,
      fieldType: field.fieldType,
      options: field.options?.join('\n') || '',
      required: field.required,
      sortOrder: field.sortOrder,
    });
    setShowModal(true);
  };

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      fieldKey: editingField ? prev.fieldKey : generateFieldKey(name),
    }));
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      fieldKey: form.fieldKey,
      fieldType: form.fieldType,
      entityType: activeTab,
      options: form.fieldType === 'dropdown' ? form.options.split('\n').filter(Boolean) : undefined,
      required: form.required,
      sortOrder: form.sortOrder,
    };

    if (editingField) {
      await apiPatch(`/api/custom-fields/${editingField.id}`, payload);
    } else {
      await apiPost('/api/custom-fields', payload);
    }

    setShowModal(false);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteField) return;
    await apiDelete(`/api/custom-fields/${deleteField.id}`);
    setDeleteField(null);
    refetch();
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Custom Fields" subtitle="Define custom fields for each entity type">
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>
          Add Field
        </Button>
      </PageHeader>

      <Tabs tabs={ENTITY_TYPES} active={activeTab} onChange={setActiveTab} />

      <div className="mt-6 glass rounded-xl p-6">
        {loading ? (
          <LoadingSpinner />
        ) : !fields.length ? (
          <EmptyState
            icon={<Settings2 className="w-12 h-12" />}
            title="No custom fields"
            description={`No custom fields defined for ${activeTab}. Add one to get started.`}
            actionLabel="Add Field"
            onAction={openAdd}
          />
        ) : (
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'Name',
                render: (f: CustomField) => (
                  <div>
                    <div className="font-medium text-white">{f.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{f.fieldKey}</div>
                  </div>
                ),
              },
              {
                key: 'fieldType',
                label: 'Type',
                render: (f: CustomField) => (
                  <Badge>{f.fieldType}</Badge>
                ),
              },
              {
                key: 'required',
                label: 'Required',
                render: (f: CustomField) => (
                  <span className={f.required ? 'text-brand-400' : 'text-slate-500'}>
                    {f.required ? 'Yes' : 'No'}
                  </span>
                ),
              },
              {
                key: 'sortOrder',
                label: 'Order',
                render: (f: CustomField) => (
                  <span className="text-slate-400">{f.sortOrder}</span>
                ),
              },
              {
                key: 'actions',
                label: '',
                className: 'w-24 text-right',
                render: (f: CustomField) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(f); }}
                      className="p-1.5 rounded-md hover:bg-surface-700 text-slate-400 hover:text-white transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteField(f); }}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ),
              },
            ]}
            data={fields}
          />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingField ? 'Edit Custom Field' : 'Add Custom Field'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.fieldKey}>
              {editingField ? 'Save Changes' : 'Add Field'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Field Name"
            required
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Contract Start Date"
          />

          <Input
            label="Field Key"
            required
            value={form.fieldKey}
            onChange={(e) => setForm({ ...form, fieldKey: e.target.value })}
            placeholder="e.g. contract_start_date"
            disabled={!!editingField}
          />
          <p className="text-xs text-slate-500 -mt-2">
            Auto-generated from name. Used as the API identifier.
          </p>

          <Select
            label="Field Type"
            value={form.fieldType}
            onChange={(e) => setForm({ ...form, fieldType: e.target.value })}
            options={FIELD_TYPES}
          />

          {form.fieldType === 'dropdown' && (
            <Textarea
              label="Dropdown Options"
              value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
              placeholder="Enter one option per line"
              rows={5}
            />
          )}

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="field-required"
              checked={form.required}
              onChange={(e) => setForm({ ...form, required: e.target.checked })}
              className="rounded border-surface-600 bg-surface-800 text-brand-600 focus:ring-brand-500/40"
            />
            <label htmlFor="field-required" className="text-sm text-surface-300">
              Required field
            </label>
          </div>

          <Input
            label="Sort Order"
            type="number"
            value={String(form.sortOrder)}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteField}
        onClose={() => setDeleteField(null)}
        onConfirm={handleDelete}
        title="Delete Custom Field"
        message={`Are you sure you want to delete "${deleteField?.name}"? This will remove the field and all associated data.`}
        confirmLabel="Delete Field"
      />
    </div>
  );
}
