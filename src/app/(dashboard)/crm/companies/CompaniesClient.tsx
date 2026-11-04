"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Button, DataTable, Badge, SearchInput, Modal, Input, Select } from "@/components/ui";
import { Plus, Building2, Globe, MapPin, Eye, Pencil, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";
import toast from "react-hot-toast";

interface Company {
  id: string; name: string; type: string; industry: string; phone: string; email: string;
  website: string; logoUrl?: string; city: string; isActive: boolean; contacts: number; tickets: number; contracts: number; createdAt: string;
}

/**
 * The company's own logo where we have one, the generic icon otherwise.
 * The URL points at the customer's server, so a broken image falls back
 * rather than leaving a gap.
 */
function CompanyLogo({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState(false);
  if (logoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-lg object-contain bg-white/5"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
      <Building2 className="h-4 w-4 text-brand-400" />
    </div>
  );
}

export default function CompaniesClient({ companies: initial }: { companies: Company[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", type: "customer", industry: "", email: "", phone: "", website: "", logoUrl: "", city: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Sites reliably declare their logo, so that is what this fetches. Reading
  // the name and address off a website was tried and dropped: real customer
  // sites publish neither, so it only ever produced empty results.
  async function lookupFromWebsite() {
    if (!form.website.trim()) return;
    setLookingUp(true);
    try {
      const res = await fetch('/api/lookup/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: form.website }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Lookup failed'); return; }
      if (!json.logoUrl) { toast(json.message || 'No logo found on that site'); return; }

      setForm(prev => ({ ...prev, logoUrl: json.logoUrl }));
      toast.success('Logo found');
    } catch {
      toast.error('Could not reach that website');
    } finally {
      setLookingUp(false);
    }
  }

  const filtered = initial.filter((c) => `${c.name} ${c.industry} ${c.city}`.toLowerCase().includes(search.toLowerCase()));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Failed"); toast.success("Company created"); setShowModal(false); router.refresh();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  const columns = [
    { key: "name", header: "Company", render: (c: Company) => (
      <div className="flex items-center gap-3">
        <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
        <div><p className="font-medium text-surface-100">{c.name}</p>{c.industry && <p className="text-xs text-surface-500">{c.industry}</p>}</div>
      </div>
    )},
    { key: "type", header: "Type", render: (c: Company) => <Badge variant="status" status={c.type}>{c.type}</Badge> },
    { key: "city", header: "Location", render: (c: Company) => c.city ? <span className="flex items-center gap-1.5 text-surface-300"><MapPin className="h-3.5 w-3.5" />{c.city}</span> : <span className="text-surface-600"> - </span> },
    { key: "contacts", header: "Contacts", render: (c: Company) => <span className="text-surface-300">{c.contacts}</span> },
    { key: "tickets", header: "Tickets", render: (c: Company) => <span className="text-surface-300">{c.tickets}</span> },
    { key: "contracts", header: "Contracts", render: (c: Company) => <span className="text-surface-300">{c.contracts}</span> },
    { key: "actions", header: "", render: (c: Company) => (
      <button onClick={(e) => { e.stopPropagation(); router.push(`/crm/companies/${c.id}`); }}
        className="p-1.5 rounded-md hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="View / Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    )},
  ];

  const update = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [f]: e.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader title="Companies" description={`${initial.length} total companies`}
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>Add Company</Button>} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="max-w-md" />
      <DataTable columns={columns} data={filtered} emptyMessage="No companies found" onRowClick={(c: Company) => router.push(`/crm/companies/${c.id}`)} />
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Company"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create</Button></>}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-400 mb-1">Website</label>
            <div className="flex gap-2">
              <input
                value={form.website}
                onChange={update("website")}
                onBlur={() => { if (form.website.trim() && !form.logoUrl) lookupFromWebsite(); }}
                placeholder="acme.com"
                className="w-full"
              />
              <button type="button" onClick={lookupFromWebsite}
                disabled={!form.website.trim() || lookingUp}
                className="btn-secondary flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40">
                <Search className="h-3.5 w-3.5" />
                {lookingUp ? 'Looking...' : 'Fetch logo'}
              </button>
            </div>
          </div>
          {form.logoUrl && (
            <div className="flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-800/40 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.logoUrl} alt="" className="h-10 w-10 rounded object-contain bg-white/5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-surface-200">Logo found on the site</p>
                <p className="truncate text-xs text-surface-500">{form.logoUrl}</p>
              </div>
              <button type="button" onClick={() => setForm({ ...form, logoUrl: "" })}
                className="text-xs text-surface-400 hover:text-white">Remove</button>
            </div>
          )}
          <Input label="Company Name" value={form.name} onChange={update("name")} required />
          <Select label="Type" value={form.type} onChange={update("type")} options={[
            {value:"prospect",label:"Prospect"},{value:"customer",label:"Customer"},{value:"vendor",label:"Vendor"},{value:"partner",label:"Partner"}
          ]} />
          <Input label="Industry" value={form.industry} onChange={update("industry")} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={update("email")} />
            <Input label="Phone" value={form.phone} onChange={update("phone")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="City" value={form.city} onChange={update("city")} />
            <Select label="Country" value={form.country} onChange={update("country")}
              placeholder=" - Select country - "
              options={COUNTRIES.map(c => ({ value: c.name, label: c.name }))} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
