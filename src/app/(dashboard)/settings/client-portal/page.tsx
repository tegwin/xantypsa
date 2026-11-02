'use client';

import { useEffect, useState } from 'react';
import { PageHeader, LoadingSpinner, Modal, Input, Select, Button } from '@/components/ui';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface Role {
  id: string; name: string;
  ticketScope: string; quoteScope: string; projectScope: string; invoiceScope: string;
  reportScope: string;
  showBlocks: boolean; canCreateTickets: boolean; canReplyTickets: boolean;
  isDefault: boolean; isActive: boolean; sortOrder: number;
  _count?: { contacts: number };
}

const SCOPES = [
  { value: 'none', label: 'Nothing' },
  { value: 'own', label: 'Their own' },
  { value: 'company', label: 'The whole company' },
];

const emptyRole = {
  name: '', ticketScope: 'own', quoteScope: 'none', projectScope: 'none',
  invoiceScope: 'none', reportScope: 'none', showBlocks: false, canCreateTickets: true,
  canReplyTickets: true, isDefault: false, sortOrder: '99',
};

export default function ClientPortalSettings() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyRole);
  const [saving, setSaving] = useState(false);

  // Assigning people to a role. A role nobody is on does nothing, so this is
  // reachable straight from the role row.
  const [assignRole, setAssignRole] = useState<Role | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const openAssign = async (r: Role) => {
    setAssignRole(r);
    const data = await fetch(`/api/portal-roles/assign?roleId=${r.id}`).then(x => x.json());
    setPeople(data.items || []);
    setPicked(new Set(data.onThisRole || []));
  };

  const saveAssign = async () => {
    if (!assignRole) return;
    setAssigning(true);
    try {
      const onNow = people.filter(p => picked.has(p.id)).map(p => p.id);
      const takenOff = people
        .filter(p => p.portalRoleId === assignRole.id && !picked.has(p.id))
        .map(p => p.id);

      if (onNow.length) {
        await fetch('/api/portal-roles/assign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleId: assignRole.id, contactIds: onNow }),
        });
      }
      // Anyone unticked goes back to the default role.
      if (takenOff.length) {
        await fetch('/api/portal-roles/assign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roleId: null, contactIds: takenOff }),
        });
      }
      toast.success(`${onNow.length} on this role`);
      setAssignRole(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Could not save');
    } finally {
      setAssigning(false);
    }
  };

  const load = async () => {
    const r = await fetch('/api/portal-roles').then(x => x.json());
    setRoles(r.items || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm(emptyRole); setShow(true); };
  const openEdit = (r: Role) => {
    setEditId(r.id);
    setForm({ ...r, sortOrder: String(r.sortOrder) });
    setShow(true);
  };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('A role needs a name'); return; }
    setSaving(true);
    try {
      const res = await fetch(editId ? `/api/portal-roles/${editId}` : '/api/portal-roles', {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      toast.success(editId ? 'Role saved' : 'Role created');
      setShow(false);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Role) => {
    if (!confirm(`Delete the "${r.name}" role?`)) return;
    const res = await fetch(`/api/portal-roles/${r.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Could not delete'); return; }
    toast.success(data.message || 'Role deleted');
    load();
  };

  if (loading) return <LoadingSpinner />;

  const scopeLabel = (v: string) => SCOPES.find(s => s.value === v)?.label || v;

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Client portal" subtitle="What your customers can see and do when they sign in">
        <button onClick={openNew} className="btn-primary text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" /> New role
        </button>
      </PageHeader>

      <div className="glass-panel p-6">
        <div className="mb-4">
          <h2 className="text-white font-semibold">Contact roles</h2>
          <p className="text-sm text-surface-400">
            A role decides what a contact sees. Scopes are coarse on purpose: nothing,
            their own records, or everything their company has. A contact with no role
            gets whichever is marked default, and failing that, only their own tickets.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Client portal roles</caption>
            <thead>
              <tr className="text-left text-xs text-surface-400 border-b border-surface-700">
                <th scope="col" className="py-2 pr-4">Role</th>
                <th scope="col" className="py-2 pr-4">Tickets</th>
                <th scope="col" className="py-2 pr-4">Projects</th>
                <th scope="col" className="py-2 pr-4">Quotes</th>
                <th scope="col" className="py-2 pr-4">Invoices</th>
                <th scope="col" className="py-2 pr-4">Reports</th>
                <th scope="col" className="py-2 pr-4">Blocks</th>
                <th scope="col" className="py-2 pr-4 text-right">People</th>
                <th scope="col" className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id} className="border-b border-surface-800">
                  <td className="py-2 pr-4">
                    <span className="text-white">{r.name}</span>
                    {r.isDefault && <span className="ml-2 text-xs text-brand-400">default</span>}
                    {!r.isActive && <span className="ml-2 text-xs text-surface-500">inactive</span>}
                  </td>
                  <td className="py-2 pr-4 text-surface-300">
                    {scopeLabel(r.ticketScope)}
                    {r.canCreateTickets && <span className="block text-xs text-surface-500">can raise</span>}
                  </td>
                  <td className="py-2 pr-4 text-surface-300">{scopeLabel(r.projectScope)}</td>
                  <td className="py-2 pr-4 text-surface-300">{scopeLabel(r.quoteScope)}</td>
                  <td className="py-2 pr-4 text-surface-300">{scopeLabel(r.invoiceScope)}</td>
                  <td className="py-2 pr-4 text-surface-300">{scopeLabel(r.reportScope)}</td>
                  <td className="py-2 pr-4 text-surface-300">{r.showBlocks ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-4 text-right text-surface-400">{r._count?.contacts ?? 0}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button onClick={() => openAssign(r)}
                      className="text-xs px-2 py-1 rounded border border-surface-600 text-surface-300 hover:border-surface-500">
                      People
                    </button>
                    <button onClick={() => openEdit(r)} aria-label={`Edit ${r.name}`}
                      className="p-1.5 rounded hover:bg-white/10 text-surface-300"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(r)} aria-label={`Delete ${r.name}`}
                      className="p-1.5 rounded hover:bg-white/10 text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
              {roles.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-surface-500">
                  No roles yet. Without one, a contact sees only their own tickets.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={show} onClose={() => setShow(false)} title={editId ? 'Edit role' : 'New role'} size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setShow(false)}>Cancel</Button>
          <Button loading={saving} onClick={save}>{editId ? 'Save changes' : 'Create role'}</Button>
        </>}>
        <div className="space-y-4">
          <Input label="Role name" value={form.name}
            onChange={(e: any) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Standard user, IT manager" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Tickets they can see" value={form.ticketScope}
              onChange={(e: any) => setForm({ ...form, ticketScope: e.target.value })} options={SCOPES} />
            <Select label="Projects they can see" value={form.projectScope}
              onChange={(e: any) => setForm({ ...form, projectScope: e.target.value })} options={SCOPES} />
            <Select label="Quotes they can see" value={form.quoteScope}
              onChange={(e: any) => setForm({ ...form, quoteScope: e.target.value })} options={SCOPES} />
            <Select label="Invoices they can see" value={form.invoiceScope}
              onChange={(e: any) => setForm({ ...form, invoiceScope: e.target.value })} options={SCOPES} />
            <Select label="Reports they can see" value={form.reportScope}
              onChange={(e: any) => setForm({ ...form, reportScope: e.target.value })} options={SCOPES} />
          </div>

          <p className="text-xs text-surface-500">
            Projects, quotes and invoices are read only in the portal. Only tickets can be
            raised and replied to.
          </p>

          <div className="space-y-2 pt-2 border-t border-surface-700/50">
            <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={!!form.canCreateTickets}
                onChange={e => setForm({ ...form, canCreateTickets: e.target.checked })} />
              <span>
                <span className="block">Can raise tickets</span>
                <span className="block text-xs text-surface-400">
                  With company-wide ticket access they can also raise one on a colleague's behalf.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
              <input type="checkbox" checked={!!form.canReplyTickets}
                onChange={e => setForm({ ...form, canReplyTickets: e.target.checked })} />
              Can reply to tickets
            </label>
            <label className="flex items-start gap-2 text-sm text-surface-300 cursor-pointer">
              <input type="checkbox" className="mt-1" checked={!!form.showBlocks}
                onChange={e => setForm({ ...form, showBlocks: e.target.checked })} />
              <span>
                <span className="block">Show prepaid hours remaining</span>
                <span className="block text-xs text-surface-400">
                  Appears in Reports, so they also need report access above.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-surface-300 cursor-pointer">
              <input type="checkbox" checked={!!form.isDefault}
                onChange={e => setForm({ ...form, isDefault: e.target.checked })} />
              Give this role to contacts who have none
            </label>
          </div>
        </div>
      </Modal>

      {assignRole && (
        <Modal isOpen={!!assignRole} onClose={() => setAssignRole(null)}
          title={`Who is on "${assignRole.name}"`} size="lg"
          footer={<>
            <Button variant="secondary" onClick={() => setAssignRole(null)}>Cancel</Button>
            <Button loading={assigning} onClick={saveAssign}>Save</Button>
          </>}>
          <div className="space-y-3">
            <p className="text-sm text-surface-400">
              Only contacts at companies whose portal is switched on are listed. Unticking
              somebody puts them back on the default role.
            </p>

            {people.length === 0 ? (
              <p className="text-sm text-surface-500">
                No company has a portal switched on yet. Turn one on from the company's
                Portal tab first.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto divide-y divide-surface-800">
                {people.map(p => {
                  const otherRole = p.portalRoleId && p.portalRoleId !== assignRole.id;
                  return (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <input type="checkbox" checked={picked.has(p.id)}
                        onChange={e => {
                          const next = new Set(picked);
                          e.target.checked ? next.add(p.id) : next.delete(p.id);
                          setPicked(next);
                        }} />
                      <span className="flex-1">
                        <span className="block text-sm text-surface-200">
                          {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                          {!p.portalEnabled && (
                            <span className="ml-2 text-xs text-amber-400">no portal access</span>
                          )}
                          {otherRole && (
                            <span className="ml-2 text-xs text-surface-500">on another role</span>
                          )}
                        </span>
                        <span className="block text-xs text-surface-500">
                          {p.company?.name}{p.email ? ` - ${p.email}` : ''}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
