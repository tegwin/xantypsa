'use client';

import { useState } from 'react';
import { useApi, apiPatch, apiDelete } from '@/hooks/useApi';
import { PageHeader, StatusBadge, LoadingSpinner, Modal } from '@/components/ui';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { User, Building2, Mail, Phone, Smartphone, MapPin, Briefcase, Edit, Trash2,
  Send, KeyRound, Eye, Globe, Linkedin } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSession } from '@/components/SessionProvider';
import CustomFieldsTab from './tabs/CustomFieldsTab';

export default function ContactDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: contact, loading, refetch } = useApi<any>(`/api/contacts/${id}`);
  const { data: companiesData } = useApi<any>('/api/companies?limit=100');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { data: appSession } = useSession();

  // Portal access for this person. Sign-in is by emailed link, so there is no
  // password here to reset: a fresh link is the equivalent.
  const { data: portal, refetch: refetchPortal } = useApi<any>(`/api/contacts/${id}/portal`);
  const [sending, setSending] = useState<string | null>(null);

  const setPortalEnabled = async (enabled: boolean) => {
    try {
      await apiPatch(`/api/contacts/${id}/portal`, { portalEnabled: enabled });
      toast.success(enabled ? 'Portal access given' : 'Portal access removed');
      refetchPortal();
    } catch (err: any) {
      toast.error(err.message || 'Could not change portal access');
    }
  };

  const sendPortalEmail = async (kind: 'welcome' | 'login') => {
    setSending(kind);
    try {
      const res = await fetch(`/api/contacts/${id}/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send');
      toast.success(`${kind === 'welcome' ? 'Welcome email' : 'Sign-in link'} sent to ${data.to}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  };

  // Opens the portal as this person. A plain link rather than fetch then
  // window.open: the browser follows the redirect with the cookie already set,
  // and nothing is popup-blocked.
  const impersonateHref = `/api/portal/impersonate?redirect=1&contactId=${id}`;

  // Administrators only, matching the server. Showing a button that always
  // refuses is worse than not showing it.
  const canImpersonate =
    !!appSession?.user?.isSuperAdmin ||
    (appSession?.user?.permissions ?? []).includes('settings:manage');

  if (loading) return <LoadingSpinner />;
  if (!contact) return <div className="p-8 text-slate-400">Contact not found</div>;

  const startEdit = () => {
    setEditForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || '',
      phone: contact.phone || '',
      mobile: contact.mobile || '',
      jobTitle: contact.jobTitle || '',
      department: contact.department || '',
      companyId: contact.companyId || '',
      notes: contact.notes || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await apiPatch(`/api/contacts/${id}`, editForm);
    setEditing(false);
    refetch();
  };

  const handleDelete = async () => {
    await apiDelete(`/api/contacts/${id}`);
    router.push('/crm/contacts');
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title={`${contact.firstName} ${contact.lastName}`} subtitle={contact.jobTitle || contact.company?.name || ''}>
        <div className="flex gap-2 flex-wrap">
          <button onClick={startEdit} className="btn-secondary flex items-center gap-1.5">
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          {portal?.portalEnabled && (
            <>
              <button onClick={() => sendPortalEmail('welcome')} disabled={sending !== null}
                className="btn-secondary flex items-center gap-1.5 disabled:opacity-50">
                <Send className="w-3.5 h-3.5" />
                {sending === 'welcome' ? 'Sending...' : 'Send Welcome Email'}
              </button>
              <button onClick={() => sendPortalEmail('login')} disabled={sending !== null}
                className="btn-secondary flex items-center gap-1.5 disabled:opacity-50">
                <KeyRound className="w-3.5 h-3.5" />
                {sending === 'login' ? 'Sending...' : 'Send Sign-in Link'}
              </button>
              {canImpersonate && (
                <a href={impersonateHref} target="_blank" rel="noreferrer"
                  className="btn-secondary flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Impersonate
                </a>
              )}
            </>
          )}
          <button onClick={() => setShowDelete(true)} className="btn-danger flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={() => router.push('/crm/contacts')} className="btn-secondary">← Back</button>
        </div>
      </PageHeader>

      {/* Tabs, the same shape as a company's */}
      <div className="flex gap-1 mb-6 overflow-x-auto border-b border-surface-700">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'tickets', label: `Tickets (${contact._count?.tickets || 0})` },
          { key: 'opportunities', label: `Opportunities (${contact._count?.opportunities || 0})` },
          { key: 'quotes', label: `Quotes (${contact._count?.quotes || 0})` },
          { key: 'custom-fields', label: 'Custom Fields' },
          { key: 'portal', label: 'Portal' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-brand-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'custom-fields' && (
        <CustomFieldsTab contact={contact} onRefresh={refetch} />
      )}

      {activeTab === 'portal' && (
        <div className="glass rounded-xl p-6 max-w-2xl space-y-5">
          <div>
            <h3 className="text-white font-semibold">Client portal</h3>
            <p className="text-sm text-surface-400">
              What this person can do in your customer portal, and how they get in.
            </p>
          </div>

          {!contact.company ? (
            <p className="text-sm text-amber-400">
              This contact has no company, and the portal belongs to a company.
            </p>
          ) : !portal?.company?.portalEnabled ? (
            <p className="text-sm text-amber-400">
              The portal is switched off for {contact.company.name}. Turn it on for the
              company first, under its own record.
            </p>
          ) : null}

          <label className="flex items-start gap-3 p-3 rounded-lg border border-surface-700 cursor-pointer hover:border-surface-600">
            <input type="checkbox" className="mt-1" checked={!!portal?.portalEnabled}
              disabled={!contact.email}
              onChange={e => setPortalEnabled(e.target.checked)} />
            <span>
              <span className="block text-sm text-surface-200">This person can sign in to the portal</span>
              <span className="block text-xs text-surface-400">
                {contact.email
                  ? `Invitations and sign-in links go to ${contact.email}.`
                  : 'Add an email address to this contact first: there is nowhere to send a link.'}
              </span>
            </span>
          </label>

          <div>
            <label className="label" htmlFor="portal-role">What they can see</label>
            <select id="portal-role" className="input w-full"
              value={portal?.portalRoleId || ''}
              onChange={async (e) => {
                await apiPatch(`/api/contacts/${id}/portal`, { portalRoleId: e.target.value || null });
                toast.success('Role updated');
                refetchPortal();
              }}>
              <option value="">
                {portal?.roles?.find((r: any) => r.isDefault)?.name
                  ? `Default (${portal.roles.find((r: any) => r.isDefault).name})`
                  : 'Default (their own tickets only)'}
              </option>
              {(portal?.roles || []).map((r: any) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {/* Spell out what the chosen role actually allows, so the effect
                of the setting is visible without going to Settings. */}
            {(() => {
              const chosen = (portal?.roles || []).find((r: any) =>
                portal?.portalRoleId ? r.id === portal.portalRoleId : r.isDefault);
              if (!chosen) {
                return (
                  <p className="text-xs text-surface-400 mt-1">
                    No role, so they see only their own tickets. Roles are set up under
                    Settings, Client Portal.
                  </p>
                );
              }
              const word = (s: string) =>
                s === 'company' ? 'the whole company' : s === 'own' ? 'their own' : 'nothing';
              return (
                <div className="mt-2 rounded-lg border border-surface-700 p-3 text-xs text-surface-400 space-y-0.5">
                  <p className="text-surface-300">{chosen.name} gives them:</p>
                  <p>Tickets: {word(chosen.ticketScope)}
                    {chosen.canCreateTickets ? ', can raise' : ', cannot raise'}
                    {chosen.canReplyTickets ? ', can reply' : ', cannot reply'}</p>
                  <p>Projects: {word(chosen.projectScope)}</p>
                  <p>Quotes: {word(chosen.quoteScope)}</p>
                  <p>Invoices: {word(chosen.invoiceScope)}</p>
                  <p>Reports: {word(chosen.reportScope)}</p>
                  <p>Prepaid hours: {chosen.showBlocks ? 'shown' : 'hidden'}</p>
                </div>
              );
            })()}
          </div>

          <div className="rounded-lg border border-surface-700 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-surface-400" />
              <span className="text-sm text-surface-200">How they sign in</span>
            </div>
            <p className="text-xs text-surface-400">
              By emailed link. There is no password to set or reset: each sign-in sends a
              single-use link that expires shortly after. Sending a new one retires any
              link already outstanding.
            </p>
            {portal?.portalLastLogin && (
              <p className="text-xs text-surface-500 mt-2">
                Last signed in {formatRelativeTime(portal.portalLastLogin)}.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => sendPortalEmail('welcome')}
              disabled={!portal?.portalEnabled || sending !== null}
              className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" /> Send welcome email
            </button>
            <button onClick={() => sendPortalEmail('login')}
              disabled={!portal?.portalEnabled || sending !== null}
              className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50">
              <KeyRound className="w-3.5 h-3.5" /> Send sign-in link
            </button>
            {canImpersonate ? (
              <a href={impersonateHref} target="_blank" rel="noreferrer"
                className={`btn-secondary text-sm flex items-center gap-1.5 ${
                  portal?.portalEnabled ? '' : 'pointer-events-none opacity-50'
                }`}>
                <Eye className="w-3.5 h-3.5" /> Impersonate
              </a>
            ) : (
              <span className="text-xs text-surface-500 self-center">
                Impersonating is for administrators only.
              </span>
            )}
          </div>

          <p className="text-xs text-surface-500">
            Impersonating opens the portal as this person in a new tab, and is recorded
            against your name.
          </p>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Tickets ({contact._count?.tickets || 0})</h3>
            {/* Raised against this person, with their company already set. */}
            <Link
              href={`/service-desk/tickets?new=1&companyId=${contact.companyId || ''}&contactId=${contact.id}`}
              className="btn-primary text-sm"
            >
              New ticket
            </Link>
          </div>
          {contact.tickets?.length > 0 ? (
            <div className="space-y-2">
              {contact.tickets.map((t: any) => (
                <Link key={t.id} href={`/service-desk/tickets/${t.id}`}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400">{t.ticketNumber}</span>
                    <span className="text-white text-sm">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.priority} />
                    <StatusBadge status={t.status} />
                    <span className="text-xs text-slate-500">{formatRelativeTime(t.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No tickets for this contact</p>
          )}
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">
              Opportunities ({contact._count?.opportunities || 0})
            </h3>
            <Link
              href={`/crm/opportunities?new=1&companyId=${contact.companyId || ''}&contactId=${contact.id}`}
              className="btn-primary text-sm"
            >
              New opportunity
            </Link>
          </div>
          {contact.opportunities?.length > 0 ? (
            <div className="space-y-2">
              {contact.opportunities.map((o: any) => (
                <Link key={o.id} href={`/crm/opportunities/${o.id}`}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                  <span className="text-white text-sm">{o.title}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs capitalize text-slate-400">{o.stage}</span>
                    <span className="text-sm text-white">{formatCurrency(o.value || 0)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No opportunities for this contact</p>
          )}
        </div>
      )}

      {activeTab === 'quotes' && (
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Quotes ({contact._count?.quotes || 0})</h3>
            <Link
              href={`/quotes/builder?companyId=${contact.companyId || ''}&contactId=${contact.id}`}
              className="btn-primary text-sm"
            >
              New quote
            </Link>
          </div>
          {contact.quotes?.length > 0 ? (
            <div className="space-y-2">
              {contact.quotes.map((q: any) => (
                <Link key={q.id} href={`/quotes/${q.id}`}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400">{q.quoteNumber}</span>
                    <span className="text-white text-sm">{q.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={q.status} />
                    <span className="text-sm text-white">{formatCurrency(q.total || 0)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No quotes for this contact</p>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* A glance at recent work; the Tickets tab has the rest. */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Recent tickets ({contact._count?.tickets || 0})</h3>
            {contact.tickets?.length > 0 ? (
              <div className="space-y-2">
                {contact.tickets.map((t: any) => (
                  <Link key={t.id} href={`/service-desk/tickets/${t.id}`}
                    className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-slate-400">{t.ticketNumber}</span>
                      <span className="text-white text-sm">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.priority} />
                      <StatusBadge status={t.status} />
                      <span className="text-xs text-slate-500">{formatRelativeTime(t.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No tickets for this contact</p>
            )}
          </div>

          {/* Notes */}
          {contact.notes && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">Notes</h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-bold text-lg">
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              <div>
                <h3 className="text-white font-semibold">{contact.firstName} {contact.lastName}</h3>
                {contact.jobTitle && <p className="text-sm text-slate-400">{contact.jobTitle}</p>}
              </div>
            </div>

            <div className="space-y-3 text-sm pt-2 border-t border-white/10">
              {contact.company && (
                <Link href={`/crm/companies/${contact.company.id}`}
                  className="flex items-center gap-2 text-brand-400 hover:text-brand-300">
                  <Building2 className="w-4 h-4" /> {contact.company.name}
                </Link>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <Mail className="w-4 h-4 text-slate-400" /> {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <Phone className="w-4 h-4 text-slate-400" /> {contact.phone}
                </a>
              )}
              {contact.mobile && (
                <a href={`tel:${contact.mobile}`} className="flex items-center gap-2 text-slate-300 hover:text-white">
                  <Smartphone className="w-4 h-4 text-slate-400" /> {contact.mobile}
                </a>
              )}
              {contact.department && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Briefcase className="w-4 h-4 text-slate-400" /> {contact.department}
                </div>
              )}
              {/* LinkedIn has no public API for looking somebody up and blocks
                  scraping, so this is a search for the person at their company
                  rather than a stored profile link. One click, then pick them. */}
              <a
                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                  [contact.firstName, contact.lastName, contact.company?.name].filter(Boolean).join(' ')
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-slate-300 hover:text-white"
              >
                <Linkedin className="w-4 h-4 text-slate-400" /> Find on LinkedIn
              </a>
              {contact.source && (
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-4 h-4 text-slate-400" /> Source: {contact.source}
                </div>
              )}
            </div>
          </div>

          {(contact.address || contact.city) && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-white font-semibold mb-3">Address</h3>
              <div className="flex items-start gap-2 text-sm text-slate-300">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  {contact.address && <div>{contact.address}</div>}
                  <div>{[contact.city, contact.state, contact.postcode].filter(Boolean).join(', ')}</div>
                  {contact.country && <div>{contact.country}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal title="Edit Contact" onClose={() => setEditing(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">First Name *</label>
                <input value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Last Name *</label>
                <input value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Company</label>
              <select value={editForm.companyId} onChange={e => setEditForm({ ...editForm, companyId: e.target.value })} className="w-full">
                <option value="">No company</option>
                {companiesData?.items?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Job Title</label>
                <input value={editForm.jobTitle} onChange={e => setEditForm({ ...editForm, jobTitle: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Department</label>
                <input value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
              <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Mobile</label>
                <input value={editForm.mobile} onChange={e => setEditForm({ ...editForm, mobile: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Notes</label>
              <textarea rows={3} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="w-full" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveEdit} className="btn-primary">Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <Modal title="Delete Contact" onClose={() => setShowDelete(false)}>
          <p className="text-slate-300 mb-6">
            Are you sure you want to delete <strong className="text-white">{contact.firstName} {contact.lastName}</strong>?
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Contact</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
