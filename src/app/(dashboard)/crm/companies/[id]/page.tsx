'use client';

import { useState } from 'react';
import { useApi, apiPatch, apiDelete } from '@/hooks/useApi';
import { PageHeader, StatusBadge, LoadingSpinner, StatCard, Modal } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useRouter, useParams } from 'next/navigation';
import {
  Users, Ticket, Receipt, Handshake, Edit, Trash2,
} from 'lucide-react';

import OverviewTab from './tabs/OverviewTab';
import ContactsTab from './tabs/ContactsTab';
import SitesTab from './tabs/SitesTab';
import CrmNotesTab from './tabs/CrmNotesTab';
import OpportunitiesTab from './tabs/OpportunitiesTab';
import { COUNTRIES, subdivisionsFor, subdivisionLabelFor } from '@/lib/countries';
import QuotesTab from './tabs/QuotesTab';
import TicketsTab from './tabs/TicketsTab';
import InvoicesTab from './tabs/InvoicesTab';
import ActivityLogTab from './tabs/ActivityLogTab';
import DocumentsTab from './tabs/DocumentsTab';
import CustomFieldsTab from './tabs/CustomFieldsTab';
import ContractsTab from './tabs/ContractsTab';
import AssetsTab from './tabs/AssetsTab';

export default function CompanyDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { data: company, loading, refetch } = useApi<any>(`/api/companies/${id}`);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  if (loading) return <LoadingSpinner />;
  if (!company) return <div className="p-8 text-slate-400">Company not found</div>;

  const startEdit = () => {
    setEditForm({
      name: company.name,
      type: company.type,
      website: company.website || '',
      // Stored as an array; edited as one-per-line text, which is far easier to
      // paste into than a tag widget.
      emailDomains: (company.emailDomains ?? []).join('\n'),
      phone: company.phone || '',
      email: company.email || '',
      address1: company.address1 || '',
      address2: company.address2 || '',
      address3: company.address3 || '',
      city: company.city || '',
      state: company.state || '',
      postcode: company.postcode || '',
      country: company.country || '',
      industry: company.industry || '',
      size: company.size || '',
      taxId: company.taxId || '',
      notes: company.notes || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    await apiPatch(`/api/companies/${id}`, editForm);
    setEditing(false);
    refetch();
  };

  const handleDelete = async () => {
    await apiDelete(`/api/companies/${id}`);
    router.push('/crm/companies');
  };

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'contacts', label: `Contacts (${company._count?.contacts || 0})` },
    { key: 'sites', label: `Sites (${company.sites?.length || 0})` },
    { key: 'crm-notes', label: 'CRM Notes' },
    { key: 'opportunities', label: `Opportunities (${company._count?.opportunities || 0})` },
    { key: 'quotes', label: `Quotes (${company._count?.quotes || 0})` },
    { key: 'contracts', label: `Contracts (${company._count?.contracts || 0})` },
    { key: 'assets', label: 'Assets' },
    { key: 'tickets', label: `Tickets (${company._count?.tickets || 0})` },
    { key: 'invoices', label: `Invoices (${company._count?.invoices || 0})` },
    { key: 'activity', label: 'Activity' },
    { key: 'documents', label: 'Documents' },
    { key: 'custom-fields', label: 'Custom Fields' },
  ];

  const invoiceTotal = company.invoices?.reduce((sum: number, inv: any) => sum + inv.total, 0) || 0;
  const invoiceDue = company.invoices?.reduce((sum: number, inv: any) => sum + inv.amountDue, 0) || 0;

  return (
    <div className="animate-fadeIn">
      <PageHeader title={company.name} subtitle={`${company.type} • ${company.industry || 'No industry'}`}>
        <div className="flex gap-2">
          <button onClick={startEdit} className="btn-secondary flex items-center gap-1.5">
            <Edit className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => setShowDelete(true)} className="btn-danger flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button onClick={() => router.push('/crm/companies')} className="btn-secondary">← Back</button>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Contacts" value={company._count?.contacts || 0} icon={<Users className="w-4 h-4" />} />
        <StatCard label="Open Tickets" value={company.tickets?.filter((t: any) => !['resolved', 'closed'].includes(t.status)).length || 0} icon={<Ticket className="w-4 h-4" />} />
        <StatCard label="Opportunities" value={company._count?.opportunities || 0} icon={<Handshake className="w-4 h-4" />} />
        <StatCard label="Invoiced" value={formatCurrency(invoiceTotal)} icon={<Receipt className="w-4 h-4" />} />
        <StatCard label="Outstanding" value={formatCurrency(invoiceDue)} icon={<Receipt className="w-4 h-4" />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab company={company} />}
      {activeTab === 'contacts' && <ContactsTab company={company} onRefresh={refetch} />}
      {activeTab === 'sites' && <SitesTab company={company} onRefresh={refetch} />}
      {activeTab === 'crm-notes' && <CrmNotesTab company={company} />}
      {activeTab === 'opportunities' && <OpportunitiesTab company={company} onRefresh={refetch} />}
      {activeTab === 'quotes' && <QuotesTab company={company} />}
      {activeTab === 'contracts' && <ContractsTab company={company} onRefresh={refetch} />}
      {activeTab === 'assets' && <AssetsTab company={company} />}
      {activeTab === 'tickets' && <TicketsTab company={company} onRefresh={refetch} />}
      {activeTab === 'invoices' && <InvoicesTab company={company} onRefresh={refetch} />}
      {activeTab === 'activity' && <ActivityLogTab company={company} />}
      {activeTab === 'documents' && <DocumentsTab company={company} />}
      {activeTab === 'custom-fields' && <CustomFieldsTab company={company} onRefresh={refetch} />}

      {/* Edit Modal */}
      {editing && (
        <Modal title="Edit Company" onClose={() => setEditing(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Name *</label>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="w-full">
                  <option value="customer">Customer</option>
                  <option value="prospect">Prospect</option>
                  <option value="vendor">Vendor</option>
                  <option value="partner">Partner</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Website</label>
              <input value={editForm.website} onChange={e => setEditForm({ ...editForm, website: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email domains</label>
              <textarea
                rows={3}
                value={editForm.emailDomains}
                onChange={e => setEditForm({ ...editForm, emailDomains: e.target.value })}
                placeholder={'acme.com\nacme.co.uk'}
                className="w-full font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">
                Email from these domains raises a ticket against this company, even when the
                sender is not yet a contact. One per line. Public mailboxes such as gmail.com
                are ignored - they would pull in every personal sender.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Industry</label>
                <input value={editForm.industry} onChange={e => setEditForm({ ...editForm, industry: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Tax ID / VAT</label>
                <input value={editForm.taxId} onChange={e => setEditForm({ ...editForm, taxId: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Address 1</label>
              <input value={editForm.address1} onChange={e => setEditForm({ ...editForm, address1: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Address 2</label>
              <input value={editForm.address2} onChange={e => setEditForm({ ...editForm, address2: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Address 3</label>
              <input value={editForm.address3} onChange={e => setEditForm({ ...editForm, address3: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Country</label>
              <select
                value={editForm.country || ''}
                // Changing country invalidates any previously chosen subdivision.
                onChange={e => setEditForm({ ...editForm, country: e.target.value, state: '' })}
                className="w-full"
              >
                <option value=""> - Select country - </option>
                {editForm.country && !COUNTRIES.some(c => c.name === editForm.country) && (
                  // Preserve a legacy free-text value so editing never silently drops it.
                  <option value={editForm.country}>{editForm.country}</option>
                )}
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">City</label>
                <input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{subdivisionLabelFor(editForm.country)}</label>
                {subdivisionsFor(editForm.country) ? (
                  <select value={editForm.state || ''} onChange={e => setEditForm({ ...editForm, state: e.target.value })} className="w-full">
                    <option value=""> - </option>
                    {subdivisionsFor(editForm.country)!.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input value={editForm.state || ''} onChange={e => setEditForm({ ...editForm, state: e.target.value })} className="w-full" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Postcode / Zip</label>
                <input value={editForm.postcode} onChange={e => setEditForm({ ...editForm, postcode: e.target.value })} className="w-full" />
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
        <Modal title="Delete Company" onClose={() => setShowDelete(false)}>
          <p className="text-slate-300 mb-6">
            Are you sure you want to delete <strong className="text-white">{company.name}</strong>?
            This will also delete all associated contacts, tickets, and other records. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowDelete(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleDelete} className="btn-danger">Delete Company</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
