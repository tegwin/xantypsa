"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Button, DataTable, Badge, SearchInput, Modal, Input, Select } from "@/components/ui";
import { Plus, Mail, Phone, Building2, Pencil } from "lucide-react";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import Can from '@/components/Can';

interface Contact {
  id: string; firstName: string; lastName: string; email: string; phone: string;
  jobTitle: string; company: string; companyId: string; isActive: boolean; createdAt: string;
}

interface CompanyOption {
  id: string; name: string;
}

export default function ContactsClient({ contacts: initial, companies = [] }: { contacts: Contact[]; companies?: CompanyOption[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", mobile: "", jobTitle: "", department: "", companyId: "" });
  const [saving, setSaving] = useState(false);

  const filtered = initial.filter((c) => {
    const q = search.toLowerCase();
    return `${c.firstName} ${c.lastName} ${c.email} ${c.company}`.toLowerCase().includes(q);
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create contact");
      toast.success("Contact created");
      setShowModal(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", mobile: "", jobTitle: "", department: "", companyId: "" });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: "name", header: "Name",
      render: (c: Contact) => (
        <div>
          <p className="font-medium text-surface-100">{c.firstName} {c.lastName}</p>
          {c.jobTitle && <p className="text-xs text-surface-500">{c.jobTitle}</p>}
        </div>
      ),
    },
    {
      key: "email", header: "Email",
      render: (c: Contact) => c.email ? (
        <span className="flex items-center gap-1.5 text-surface-300"><Mail className="h-3.5 w-3.5" />{c.email}</span>
      ) : <span className="text-surface-600"> - </span>,
    },
    {
      key: "phone", header: "Phone",
      render: (c: Contact) => c.phone ? (
        <span className="flex items-center gap-1.5 text-surface-300"><Phone className="h-3.5 w-3.5" />{c.phone}</span>
      ) : <span className="text-surface-600"> - </span>,
    },
    {
      key: "portal", header: "Portal",
      render: (c: any) => !c.portalEnabled
        ? <span className="text-surface-600">No access</span>
        : <span className="text-surface-300">{c.portalRole || 'Default role'}</span>,
    },
    {
      key: "company", header: "Company",
      render: (c: Contact) => c.company ? (
        <span className="flex items-center gap-1.5 text-surface-300"><Building2 className="h-3.5 w-3.5" />{c.company}</span>
      ) : <span className="text-surface-600"> - </span>,
    },
    {
      key: "status", header: "Status",
      render: (c: Contact) => <Badge variant="status" status={c.isActive ? "active" : "closed"}>{c.isActive ? "Active" : "Inactive"}</Badge>,
    },
    { key: "createdAt", header: "Created", render: (c: Contact) => <span className="text-surface-400 text-xs">{formatDate(c.createdAt)}</span> },
    { key: "actions", header: "", render: (c: Contact) => (
      <button onClick={(e) => { e.stopPropagation(); router.push(`/crm/contacts/${c.id}`); }}
        className="p-1.5 rounded-md hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="View / Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    )},
  ];

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const companyOptions = [
    { value: "", label: "No company" },
    ...companies.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Contacts" description={`${initial.length} total contacts`}
        actions={<Can module="crm" action="create"><Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>Add Contact</Button></Can>} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search contacts..." className="max-w-md" />
      <DataTable columns={columns} data={filtered} emptyMessage="No contacts found" onRowClick={(c: Contact) => router.push(`/crm/contacts/${c.id}`)} />
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Contact"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create Contact</Button></>}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={update("firstName")} required />
            <Input label="Last Name" value={form.lastName} onChange={update("lastName")} required />
          </div>
          <Select label="Company" options={companyOptions} value={form.companyId} onChange={update("companyId")} />
          <Input label="Email" type="email" value={form.email} onChange={update("email")} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={update("phone")} />
            <Input label="Mobile" value={form.mobile} onChange={update("mobile")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Job Title" value={form.jobTitle} onChange={update("jobTitle")} />
            <Input label="Department" value={form.department} onChange={update("department")} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
