'use client';

import { useState } from 'react';
import { useApi, apiPost, apiPatch, apiDelete } from '@/hooks/useApi';
import { PageHeader, Modal, LoadingSpinner, EmptyState } from '@/components/ui';
import { Shield, Edit, Trash2, Plus, Users, Lock } from 'lucide-react';
import {
  MODULES, ACTIONS, ROLE_TEMPLATES, MODULE_LABELS, ACTION_LABELS,
  type Module, type Action, type Permission,
} from '@/lib/permissions';

const TEMPLATE_KEYS = ['admin', 'manager', 'technician', 'sales', 'finance', 'viewer'] as const;

const emptyForm = {
  name: '',
  description: '',
  permissions: [] as string[],
};

export default function SettingsRolesPage() {
  const { data, loading, refetch } = useApi<any>('/api/settings/roles');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const roles = data?.items || [];

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, permissions: [] });
    setShowModal(true);
  };

  const openEdit = (role: any) => {
    setEditingId(role.id);
    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    setForm({
      name: role.name || '',
      description: role.description || '',
      permissions: [...perms],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description || null,
      permissions: form.permissions,
    };

    let res;
    if (editingId) {
      res = await apiPatch(`/api/settings/roles/${editingId}`, payload);
    } else {
      res = await apiPost('/api/settings/roles', payload);
    }
    setSaving(false);
    if (res) {
      setShowModal(false);
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const res = await apiDelete(`/api/settings/roles/${deleteConfirm.id}`);
    if (res) {
      setDeleteConfirm(null);
      refetch();
    }
  };

  const togglePermission = (perm: string) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const toggleModule = (mod: Module) => {
    const modulePerms = ACTIONS.map(a => `${mod}:${a}`);
    const allChecked = modulePerms.every(p => form.permissions.includes(p));
    setForm(prev => ({
      ...prev,
      permissions: allChecked
        ? prev.permissions.filter(p => !p.startsWith(`${mod}:`))
        : [...new Set([...prev.permissions, ...modulePerms])],
    }));
  };

  const toggleAction = (action: Action) => {
    const actionPerms = MODULES.map(m => `${m}:${action}`);
    const allChecked = actionPerms.every(p => form.permissions.includes(p));
    setForm(prev => ({
      ...prev,
      permissions: allChecked
        ? prev.permissions.filter(p => !p.endsWith(`:${action}`))
        : [...new Set([...prev.permissions, ...actionPerms])],
    }));
  };

  const applyTemplate = (key: string) => {
    const template = ROLE_TEMPLATES[key as keyof typeof ROLE_TEMPLATES];
    if (!template) return;
    setForm(prev => ({
      ...prev,
      name: prev.name || template.name,
      description: prev.description || template.description,
      permissions: [...template.permissions],
    }));
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Roles & Permissions" subtitle="Configure access control for your team">
        <button onClick={openCreate} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Role
        </button>
      </PageHeader>

      {loading ? <LoadingSpinner /> : !roles.length ? (
        <div className="glass rounded-xl p-6">
          <EmptyState title="No roles configured" description="Create your first role to manage access control" actionLabel="Add Role" onAction={openCreate} />
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role: any) => {
            const permCount = Array.isArray(role.permissions) ? role.permissions.length : 0;
            const userCount = role._count?.users || 0;
            return (
              <div key={role.id} className="glass rounded-xl p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-600/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-brand-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold">{role.name}</h3>
                        {role.isSystem && (
                          <span className="flex items-center gap-1 text-xs bg-white/10 text-slate-400 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3" /> System
                          </span>
                        )}
                      </div>
                      {role.description && <p className="text-slate-400 text-sm mt-0.5">{role.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {userCount} user{userCount !== 1 ? 's' : ''}
                        </span>
                        <span>{permCount} permission{permCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!role.isSystem && (
                      <>
                        <button onClick={() => openEdit(role)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(role)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {role.isSystem && (
                      <button onClick={() => openEdit(role)} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors" title="View permissions">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Role Modal */}
      {showModal && (
        <Modal title={editingId ? 'Edit Role' : 'Add Role'} onClose={() => setShowModal(false)}>
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Role Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full" placeholder="e.g. Project Manager" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full" placeholder="Brief description of this role" />
            </div>

            {/* Quick-fill templates */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Quick Fill from Template</label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_KEYS.map(key => {
                  const t = ROLE_TEMPLATES[key];
                  return (
                    <button key={key} onClick={() => applyTemplate(key)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors border border-white/10">
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permission Matrix */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Permissions ({form.permissions.length} selected)
              </label>
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="text-left px-3 py-2 text-slate-400 font-medium text-xs">Module</th>
                      {ACTIONS.map(action => (
                        <th key={action} className="px-2 py-2 text-center">
                          <button onClick={() => toggleAction(action)}
                            className="text-slate-400 hover:text-white text-xs font-medium transition-colors">
                            {ACTION_LABELS[action]}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map(mod => {
                      const modulePerms = ACTIONS.map(a => `${mod}:${a}`);
                      const allChecked = modulePerms.every(p => form.permissions.includes(p));
                      return (
                        <tr key={mod} className="border-t border-white/5 hover:bg-white/[0.02]">
                          <td className="px-3 py-2">
                            <button onClick={() => toggleModule(mod)}
                              className={`text-xs font-medium transition-colors ${allChecked ? 'text-brand-400' : 'text-slate-300 hover:text-white'}`}>
                              {MODULE_LABELS[mod]}
                            </button>
                          </td>
                          {ACTIONS.map(action => {
                            const perm = `${mod}:${action}` as Permission;
                            const checked = form.permissions.includes(perm);
                            return (
                              <td key={action} className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(perm)}
                                  className="w-4 h-4 rounded border-slate-600 bg-white/5 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-surface-800 pb-1">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary" disabled={!form.name || saving}>
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <Modal title="Delete Role" onClose={() => setDeleteConfirm(null)}>
          <div className="space-y-4">
            {deleteConfirm.isSystem ? (
              <p className="text-slate-300">
                <strong className="text-white">{deleteConfirm.name}</strong> is a system role and cannot be deleted.
              </p>
            ) : deleteConfirm._count?.users > 0 ? (
              <p className="text-slate-300">
                <strong className="text-white">{deleteConfirm.name}</strong> has {deleteConfirm._count.users} assigned user(s).
                Please reassign those users to another role before deleting.
              </p>
            ) : (
              <p className="text-slate-300">
                Are you sure you want to delete <strong className="text-white">{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button>
              {!deleteConfirm.isSystem && !deleteConfirm._count?.users && (
                <button onClick={handleDelete} className="btn-danger">Delete Role</button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
