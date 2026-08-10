'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { PageHeader, Button, LoadingSpinner, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { useSession } from '@/components/SessionProvider';
import { UserCog, ShieldCheck, PoundSterling, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'general', label: 'General', icon: UserIcon },
  { key: 'role', label: 'Role & Access', icon: UserCog },
  { key: 'security', label: 'Security', icon: ShieldCheck },
  { key: 'costs', label: 'Costs', icon: PoundSterling },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function UserEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: user, loading, error, refetch } = useApi<any>(`/api/users/${id}`);

  const [tab, setTab] = useState<TabKey>('general');
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [impersonating, setImpersonating] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? '',
        phone: user.phone ?? '',
        isActive: user.isActive ?? true,
        roleId: user.roleId ?? '',
        mfaRequired: user.mfaRequired ?? false,
        costRate: user.costRate ?? '',
      });
    }
  }, [user]);

  // Only owners and super admins may see or change cost rates — it is
  // effectively salary information.
  const canSeeCosts = session?.user?.isSuperAdmin || user?.isOwner || session?.user?.permissions?.includes('settings:manage');
  const isSelf = session?.user?.id === user?.id;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          costRate: form.costRate === '' ? null : parseFloat(form.costRate),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(err.error || 'Save failed');
      }
      toast.success('User updated');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const impersonate = async () => {
    if (!confirm(`View VibePSA as ${user.name}? Everything you do will be recorded against you.`)) return;
    setImpersonating(true);
    try {
      const res = await fetch('/api/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not impersonate');
      window.location.href = '/'; // full reload so the server session re-resolves
    } catch (err: any) {
      toast.error(err.message);
      setImpersonating(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="glass rounded-xl p-4 text-red-300 text-sm">{error}</div>;
  if (!user) return <div className="text-surface-400">User not found</div>;

  const visibleTabs = TABS.filter((t) => t.key !== 'costs' || canSeeCosts);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title={user.name} subtitle={user.email}>
        <div className="flex items-center gap-2">
          {!isSelf && user.isActive && (
            <Button variant="secondary" loading={impersonating} onClick={impersonate}>
              View as this user
            </Button>
          )}
          <Button variant="secondary" onClick={() => router.push('/settings/users')}>
            Back
          </Button>
          <Button loading={saving} onClick={save}>Save changes</Button>
        </div>
      </PageHeader>

      <div className="flex gap-2 border-b border-white/10">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-brand-500 text-brand-400'
                  : 'border-transparent text-surface-400 hover:text-surface-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'general' && (
        <div className="glass rounded-xl p-6 space-y-4 max-w-2xl">
          <div>
            <label className="label">Name</label>
            <input className="input w-full" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input w-full opacity-60" value={user.email} disabled />
            <p className="text-xs text-surface-500 mt-1">
              Email is the sign-in identity and is managed in Supabase Auth — it can&apos;t be
              changed here.
            </p>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input w-full" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-surface-300">
            <input type="checkbox" checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active — inactive users can&apos;t sign in and are hidden from assignment
          </label>
          <div className="pt-3 border-t border-white/10 text-xs text-surface-500 space-y-1">
            <div>Last sign-in: {user.lastLogin ? formatDate(user.lastLogin) : 'never'}</div>
            <div>Created: {formatDate(user.createdAt)}</div>
          </div>
        </div>
      )}

      {tab === 'role' && (
        <div className="glass rounded-xl p-6 space-y-4 max-w-2xl">
          <div>
            <label className="label">Role</label>
            <select className="input w-full" value={form.roleId}
              onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              {(user.roles ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <p className="text-xs text-surface-500 mt-1">
              The role decides which modules and actions this person can reach. Edit the
              permissions themselves under Settings → Roles.
            </p>
          </div>

          {user.isOwner && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300">
              This user is a tenant <strong>owner</strong>. Owners can manage billing, cost rates
              and impersonation regardless of their role.
            </div>
          )}
          {user.isSuperAdmin && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
              <strong>Super admin.</strong> Bypasses all permission checks.
            </div>
          )}
        </div>
      )}

      {tab === 'security' && (
        <div className="glass rounded-xl p-6 space-y-4 max-w-2xl">
          <label className="flex items-start gap-3 text-sm text-surface-300">
            <input type="checkbox" className="mt-1" checked={form.mfaRequired}
              onChange={(e) => setForm({ ...form, mfaRequired: e.target.checked })} />
            <span>
              <span className="font-medium text-surface-100">Require two-factor authentication</span>
              <br />
              Enforced immediately: on their next page load they are sent to set up an
              authenticator and cannot reach VibePSA until it is done.
            </span>
          </label>

          <div className="rounded-lg border border-white/10 p-3 text-sm text-surface-400">
            <p className="font-medium text-surface-200 mb-1">Passwords</p>
            <p>
              Passwords are held by Supabase Auth, not VibePSA — nobody here can read or set
              one. Send the user to <span className="text-surface-200">Forgot password?</span> on
              the sign-in screen to reset it themselves.
            </p>
          </div>
        </div>
      )}

      {tab === 'costs' && canSeeCosts && (
        <div className="glass rounded-xl p-6 space-y-4 max-w-2xl">
          <div>
            <label className="label">Internal cost per hour</label>
            <div className="flex items-center gap-2">
              <span className="text-surface-400">£</span>
              <input className="input w-40 text-right" type="number" step="0.01" min="0"
                value={form.costRate} placeholder="not set"
                onChange={(e) => setForm({ ...form, costRate: e.target.value })} />
            </div>
            <p className="text-xs text-surface-500 mt-2">
              What an hour of this person&apos;s time costs the business, for
              <strong> {session?.user?.tenantName ?? 'this tenant'}</strong>. Used to work out
              profitability — revenue earned minus what delivering it cost. Never shown to
              customers and never appears on an invoice.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 p-3 text-sm text-surface-400">
            <p className="font-medium text-surface-200 mb-1">How this is used</p>
            <p>
              The rate is captured onto each time entry as it is logged, so changing it here
              affects future work only — past profitability stays as it was reported. The rate
              applies to this tenant alone; the same person can carry a different cost in
              another tenant.
            </p>
          </div>

          {!form.costRate && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300">
              No cost rate set — this person&apos;s time currently counts as free, which
              overstates profit on anything they work on.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
