'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi, apiPost } from '@/hooks/useApi';
import { PageHeader, DataTable, StatusBadge, Modal, EmptyState, LoadingSpinner } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export default function SettingsUsersPage() {
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const { data, loading, refetch } = useApi<any>('/api/users');
  const { data: rolesData } = useApi<any>('/api/settings/roles');

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', roleId: '', costRate: '' });

  const handleInvite = async () => {
    const res = await apiPost('/api/users', form);
    if (res) {
      setShowInvite(false);
      setForm({ name: '', email: '', password: '', phone: '', roleId: '', costRate: '' });
      refetch();
    }
  };

  const users = data?.items || [];
  const roles = rolesData?.items || [];

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Users" subtitle="Manage team members and access">
        <button onClick={() => setShowInvite(true)} className="btn-primary">+ Add User</button>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        {loading ? <LoadingSpinner /> : users.length === 0 ? (
          <EmptyState title="No users" description="Add your first team member" actionLabel="Add User" onAction={() => setShowInvite(true)} />
        ) : (
          <DataTable
            onRowClick={(r: any) => router.push(`/settings/users/${r.user?.id ?? r.id}`)}
            columns={[
              { key: 'name', label: 'Name', render: (r: any) => (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-sm font-medium text-brand-400">
                    {r.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-white">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.email}</div>
                  </div>
                </div>
              )},
              { key: 'costRate', label: 'Cost / hr', render: (r: any) => (
                r.costRate != null
                  ? <span className="text-surface-200">£{Number(r.costRate).toFixed(2)}</span>
                  : <span className="text-amber-400/70 text-xs">not set</span>
              )},
              { key: 'role', label: 'Role', render: (r: any) => (
                r.role ? (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">{r.role.name}</span>
                ) : (
                  <span className="text-xs text-slate-500">No role</span>
                )
              )},
              { key: 'isActive', label: 'Status', render: (r: any) => <StatusBadge status={r.isActive ? 'active' : 'inactive'} /> },
              { key: 'lastLogin', label: 'Last Login', render: (r: any) => (
                <span className="text-slate-400 text-sm">{r.lastLogin ? formatDate(r.lastLogin) : 'Never'}</span>
              )},
              { key: 'createdAt', label: 'Created', render: (r: any) => <span className="text-slate-400 text-sm">{formatDate(r.createdAt)}</span> },
            ]}
            data={users}
          />
        )}
      </div>

      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Add User">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Full Name *</label>
            <input className="w-full" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Email *</label>
            <input className="w-full" type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Password *</label>
            <input className="w-full" type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
            <input className="w-full" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
          </div>
          <div>
            <label className="label">Internal cost per hour</label>
            <input className="w-full" type="number" step="0.01" value={form.costRate}
              onChange={(e) => setForm({...form, costRate: e.target.value})} placeholder="e.g. 40.00" />
            <p className="text-xs text-slate-500 mt-1">
              What an hour of this engineer&apos;s time costs the business. Used to work out
              profitability; never shown to customers.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Role *</label>
            <select className="w-full" value={form.roleId} onChange={(e) => setForm({...form, roleId: e.target.value})}>
              <option value="">Select a role</option>
              {roles.map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}{r.isSystem ? ' (System)' : ''}</option>
              ))}
            </select>
            {roles.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">No roles found. Create roles in Settings → Roles first.</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleInvite} disabled={!form.name || !form.email || form.password.length < 8} className="btn-primary">Add User</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

