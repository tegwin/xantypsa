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
  website: string; city: string; isActive: boolean; contacts: number; tickets: number; contracts: number; createdAt: string;
}

export default function CompaniesClient({ companies: initial }: { companies: Company[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", type: "customer", industry: "", email: "", phone: "", website: "", city: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // Most of a new company's details are already published on its own website,
  // so the domain goes first and fills in what it can. Everything stays
  // editable, and nothing already typed is overwritten.
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
      if (!json.company) { toast(json.message || 'Nothing published on that site'); return; }

      const found = json.company;
      const filled: string[] = [];
      setForm(prev => {
        const next = { ...prev };
        const put = (field: keyof typeof prev, value?: string) => {
          if (value && !String(prev[field] || '').trim()) {
            (next[field] as string) = value;
            filled.push(field);
          }
        };
        put('name', found.name);
        put('email', found.email);
        put('phone', found.phone);
        put('city', found.address?.city);
        put('country', found.address?.country);
        return next;
      });
      toast[filled.length ? 'success' : 'error'](
        filled.length
          ? `Filled in ${filled.join(', ')}`
          : 'Found the site, but nothing new to fill in'
      );
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
        <div className="w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-brand-400" /></div>
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
          {/* The website comes first: give it a domain and the rest fills
              itself in where the site publishes it. */}
          <div>
            <label className="block text-sm font-medium text-surface-400 mb-1">Website</label>
            <div className="flex gap-2">
              <input
                value={form.website}
                onChange={update("website")}
                onBlur={() => { if (form.website.trim() && !form.name.trim()) lookupFromWebsite(); }}
                placeholder="acme.com"
                className="w-full"
              />
              <button type="button" onClick={lookupFromWebsite}
                disabled={!form.website.trim() || lookingUp}
                className="btn-secondary flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40">
                <Search className="h-3.5 w-3.5" />
                {lookingUp ? 'Looking...' : 'Look up'}
              </button>
            </div>
            <p className="text-xs text-surface-500 mt-1">
              Fills in whatever the site publishes. Plenty of sites publish nothing, so just
              carry on typing if it comes back empty.
            </p>
          </div>
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
