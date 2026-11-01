"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Button, DataTable, Badge, SearchInput, Modal, Input, Select, Textarea, Tabs } from "@/components/ui";
import { useApi } from "@/hooks/useApi";
import { Plus, LifeBuoy, Clock, Filter, Pencil, Layers, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface Ticket {
  id: string; ticketNumber: number; title: string; status: string; priority: string; type: string;
  category: string; company: string; contact: string; assignedTo: string; queue: string; queueId: string; source: string;
  createdAt: string; timeSpent: number;
}

// Default statuses - "all" here means "all except closed"
const STATUSES = ["all","new","open","pending","waiting","resolved","closed"];

export default function TicketsClient({ tickets: initial, queues, agents, companies, customStatuses }: {
  tickets: Ticket[]; queues: {id:string;name:string}[]; agents: {id:string;name:string}[];
  companies: {id:string;name:string}[];
  customStatuses?: { slug: string; name: string; isClosed: boolean; color: string }[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", type: "incident", queueId: queues[0]?.id || "", companyId: "", contractId: "" });
  const [saving, setSaving] = useState(false);
  const { data: contractsData } = useApi<any>(form.companyId ? `/api/contracts?companyId=${form.companyId}&status=active&limit=50` : null);

  // Determine which statuses count as "closed"
  const closedSlugs = customStatuses?.length
    ? customStatuses.filter(s => s.isClosed).map(s => s.slug)
    : ['closed'];

  // Build status tabs from custom statuses or defaults
  const statusList = customStatuses?.length
    ? [{ slug: 'all', name: 'Active', isClosed: false }, ...customStatuses]
    : STATUSES.map(s => ({ slug: s, name: s === 'all' ? 'Active' : s.charAt(0).toUpperCase() + s.slice(1), isClosed: s === 'closed' }));

  const filtered = initial.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch = `${t.ticketNumber} ${t.title} ${t.company} ${t.contact} ${t.assignedTo}`.toLowerCase().includes(q);

    let matchesStatus;
    if (statusFilter === "all") {
      // "Active" tab = everything except closed statuses
      matchesStatus = !closedSlugs.includes(t.status);
    } else {
      matchesStatus = t.status === statusFilter;
    }

    const matchesQueue = queueFilter === "all" || t.queueId === queueFilter;
    return matchesSearch && matchesStatus && matchesQueue;
  });

  // Counts for tabs
  const statusCounts = statusList.map(s => ({
    id: s.slug,
    label: s.slug === "all" ? "Active" : s.name,
    count: s.slug === "all"
      ? initial.filter(t => !closedSlugs.includes(t.status)).length
      : initial.filter(t => t.status === s.slug).length,
  }));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Failed"); toast.success("Ticket created"); setShowModal(false);
      setForm({ title: "", description: "", priority: "medium", type: "incident", queueId: queues[0]?.id || "", companyId: "", contractId: "" }); router.refresh();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  const update = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const columns = [
    { key: "id", header: "#", render: (t: Ticket) => <span className="text-xs font-mono text-surface-500">#{t.ticketNumber}</span>, className: "w-20" },
    { key: "title", header: "Subject", render: (t: Ticket) => (
      <div><p className="font-medium text-surface-100 truncate max-w-xs">{t.title}</p>
        <p className="text-xs text-surface-500">{t.company}{t.contact ? ` · ${t.contact}` : ""}</p></div>
    )},
    { key: "status", header: "Status", render: (t: Ticket) => {
      const custom = customStatuses?.find(s => s.slug === t.status);
      if (custom) return <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: custom.color + '20', color: custom.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: custom.color }} />{custom.name}</span>;
      return <Badge variant="status" status={t.status}>{t.status}</Badge>;
    }},
    { key: "priority", header: "Priority", render: (t: Ticket) => <Badge variant="status" status={t.priority}>{t.priority}</Badge> },
    { key: "assignedTo", header: "Assigned", render: (t: Ticket) => <span className={t.assignedTo === "Unassigned" ? "text-surface-600" : "text-surface-300"}>{t.assignedTo}</span> },
    { key: "queue", header: "Queue", render: (t: Ticket) => (
      <span className="text-surface-400 text-xs flex items-center gap-1">
        <Layers className="h-3 w-3" />{t.queue || " - "}
      </span>
    )},
    { key: "time", header: "Time", render: (t: Ticket) => <span className="flex items-center gap-1 text-xs text-surface-400"><Clock className="h-3 w-3" />{Math.floor(t.timeSpent/60)}h {t.timeSpent%60}m</span> },
    { key: "created", header: "Created", render: (t: Ticket) => <span className="text-xs text-surface-500">{formatDate(t.createdAt, "relative")}</span> },
    { key: "actions", header: "", render: (t: Ticket) => (
      <button onClick={(e) => { e.stopPropagation(); router.push(`/service-desk/tickets/${t.id}`); }}
        className="p-1.5 rounded-md hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="View / Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Tickets" description={`${filtered.length} tickets${statusFilter === 'all' ? ' (active)' : ''}`}
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>New Ticket</Button>} />

      <Tabs tabs={statusCounts} active={statusFilter} onChange={setStatusFilter} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tickets..." className="flex-1 max-w-md" />

        {/* Queue filter */}
        {queues.length > 0 && (
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-surface-400" />
            <select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value)}
              className="!py-1.5 text-sm min-w-[140px]">
              <option value="all">All Queues</option>
              {queues.map(q => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
            {queueFilter !== "all" && (
              <button onClick={() => setQueueFilter("all")} className="text-surface-400 hover:text-surface-200">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <DataTable columns={columns} data={filtered} emptyMessage="No tickets found" onRowClick={(t: any) => router.push(`/service-desk/tickets/${t.id}`)} />

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Ticket" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create Ticket</Button></>}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Select label="Company" value={form.companyId}
            onChange={(e: any) => setForm({...form, companyId: e.target ? e.target.value : e, contractId: ""})}
            options={[{value:"",label:" - Select company - "}, ...companies.map(c => ({value:c.id,label:c.name}))]} required />
          {form.companyId && contractsData?.items?.length > 0 && (
            <Select label="Contract (optional)" value={form.contractId}
              onChange={(e: any) => setForm({...form, contractId: e.target ? e.target.value : e})}
              options={[{value:"",label:"No contract (T&M)"}, ...contractsData.items.map((c: any) => ({
                value: c.id,
                label: `${c.name} (${c.type === 'prepay_hours' ? 'Block' : c.type === 'managed_service' ? 'Managed' : c.type === 'fixed_price' ? 'Fixed' : 'T&M'})`
              }))]} />
          )}
          <Input label="Subject" value={form.title} onChange={update("title")} required />
          <Textarea label="Description" value={form.description} onChange={update("description")} required rows={4} />
          <div className="grid grid-cols-3 gap-4">
            <Select label="Priority" value={form.priority} onChange={update("priority")}
              options={[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"},{value:"critical",label:"Critical"}]} />
            <Select label="Type" value={form.type} onChange={update("type")}
              options={[{value:"incident",label:"Incident"},{value:"service_request",label:"Service Request"},{value:"problem",label:"Problem"},{value:"change",label:"Change"}]} />
            <Select label="Queue" value={form.queueId} onChange={update("queueId")}
              options={queues.map(q => ({value:q.id,label:q.name}))} />
          </div>
        </form>
      </Modal>
    </div>
  );
}
