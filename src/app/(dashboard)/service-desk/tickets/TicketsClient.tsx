"use client";
import React, { useEffect, useState } from "react";
import { useReferenceFormat } from '@/hooks/useReferenceFormat';
import { useSearchParams } from 'next/navigation';
import { useRouter } from "next/navigation";
import { PageHeader, Button, DataTable, Badge, SearchInput, Modal, Input, Select, Textarea, Tabs } from "@/components/ui";
import { useApi } from "@/hooks/useApi";
import { Plus, LifeBuoy, Clock, Filter, Pencil, Layers, X, Columns3 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface Ticket {
  id: string; ticketNumber: number; title: string; status: string; priority: string; type: string;
  category: string; company: string; contact: string; assignedTo: string; queue: string; queueId: string; source: string;
  createdAt: string; timeSpent: number;
}

/**
 * The columns a person can switch on, in the order they appear.
 *
 * Reference, Subject and the edit button are always shown, so they are not
 * listed here. Everything else is a preference, remembered per browser.
 */
const OPTIONAL_COLUMNS: { key: string; label: string }[] = [
  { key: 'company', label: 'Customer' },
  { key: 'contact', label: 'Contact' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'type', label: 'Type' },
  { key: 'category', label: 'Category' },
  { key: 'assignedTo', label: 'Assigned' },
  { key: 'queue', label: 'Queue' },
  { key: 'time', label: 'Time' },
  { key: 'created', label: 'Created' },
];

const DEFAULT_COLUMNS = ['company', 'status', 'priority', 'assignedTo', 'queue', 'time', 'created'];

// Default statuses - "all" here means "all except closed"
const STATUSES = ["all","new","open","pending","waiting","resolved","closed"];

export default function TicketsClient({ tickets: initial, queues, agents, companies, customStatuses }: {
  tickets: Ticket[]; queues: {id:string;name:string}[]; agents: {id:string;name:string}[];
  companies: {id:string;name:string}[];
  customStatuses?: { slug: string; name: string; isClosed: boolean; color: string }[];
}) {
  const router = useRouter();
  const { ref } = useReferenceFormat();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [queueFilter, setQueueFilter] = useState("all");
  // Flat list, or gathered under a heading per queue or per engineer.
  const [groupBy, setGroupBy] = useState<'none' | 'queue' | 'agent'>('none');
  const [showModal, setShowModal] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  // Which optional columns are on. Reference, Subject and the edit button are
  // not in here: a list with no subject is not a list.
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('xantypsa.ticketColumns');
      if (saved) setVisibleColumns(JSON.parse(saved));
    } catch {
      // Blocked or malformed storage: the defaults are a fine answer.
    }
  }, []);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      try {
        localStorage.setItem('xantypsa.ticketColumns', JSON.stringify(next));
      } catch {
        // The choice just does not outlive the page.
      }
      return next;
    });
  };
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", type: "incident", queueId: queues[0]?.id || "", companyId: "", contactId: "", contractId: "" });
  const [saving, setSaving] = useState(false);
  const { data: contractsData } = useApi<any>(form.companyId ? `/api/contracts?companyId=${form.companyId}&status=active&limit=50` : null);
  // Contacts belong to the company, so the list follows whichever is chosen.
  const { data: contactsData } = useApi<any>(form.companyId ? `/api/contacts?companyId=${form.companyId}&limit=200` : null);

  // Arriving from a contact's page with ?new=1 opens the form on that person.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setForm(f => ({
      ...f,
      companyId: searchParams.get('companyId') || f.companyId,
      contactId: searchParams.get('contactId') || f.contactId,
    }));
    setShowModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // Gathered by whichever heading is chosen, biggest group first, with the
  // unassigned and unqueued bucket kept last where it belongs.
  const groups = (() => {
    if (groupBy === 'none') return [];
    const map = new Map<string, Ticket[]>();
    for (const t of filtered) {
      const key = groupBy === 'queue'
        ? (t.queue || 'No queue')
        : (t.assignedTo && t.assignedTo !== 'Unassigned' ? t.assignedTo : 'Unassigned');
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    const spare = ['No queue', 'Unassigned'];
    return [...map.entries()]
      .map(([label, rows]) => ({ label, rows }))
      .sort((a, b) => {
        const aSpare = spare.includes(a.label), bSpare = spare.includes(b.label);
        if (aSpare !== bSpare) return aSpare ? 1 : -1;
        return b.rows.length - a.rows.length;
      });
  })();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Failed"); toast.success("Ticket created"); setShowModal(false);
      setForm({ title: "", description: "", priority: "medium", type: "incident", queueId: queues[0]?.id || "", companyId: "", contactId: "", contractId: "" }); router.refresh();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  const update = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const allColumns = [
    { key: "id", header: "Reference", render: (t: Ticket) => (
      <span className="text-xs font-mono text-surface-400">{ref('ticket', t.ticketNumber)}</span>
    ), className: "w-28" },
    { key: "title", header: "Subject", render: (t: Ticket) => (
      <div>
        <p className="font-medium text-surface-100 truncate max-w-xs">{t.title}</p>
        {/* Only as a subtitle when the customer has no column of its own,
            so the same name is not printed twice on every row. */}
        {!visibleColumns.includes('company') && (
          <p className="text-xs text-surface-500">{t.company}{t.contact ? ` · ${t.contact}` : ""}</p>
        )}
      </div>
    )},
    // The company was only ever a subtitle under the subject, which meant it
    // could not be sorted on, scanned down, or switched off.
    { key: "company", header: "Customer", render: (t: Ticket) => (
      <span className="text-surface-300">{t.company || " - "}</span>
    )},
    { key: "contact", header: "Contact", render: (t: Ticket) => (
      <span className="text-surface-400">{t.contact || " - "}</span>
    )},
    { key: "type", header: "Type", render: (t: Ticket) => (
      <span className="capitalize text-surface-400">{t.type?.replace(/_/g, ' ') || " - "}</span>
    )},
    { key: "category", header: "Category", render: (t: Ticket) => (
      <span className="capitalize text-surface-400">{t.category || " - "}</span>
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

  // Reference, Subject and the edit button always stay.
  const columns = allColumns.filter(
    (c) => ['id', 'title', 'actions'].includes(c.key) || visibleColumns.includes(c.key)
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Tickets" description={`${filtered.length} tickets${statusFilter === 'all' ? ' (active)' : ''}`}
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>New Ticket</Button>} />

      <Tabs tabs={statusCounts} active={statusFilter} onChange={setStatusFilter} />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tickets..." className="flex-1 max-w-md" />

        {/* Group the list by queue or by engineer. */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500">View</span>
          {([
            { key: 'none' as const, label: 'List' },
            { key: 'queue' as const, label: 'By queue' },
            { key: 'agent' as const, label: 'By engineer' },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setGroupBy(opt.key)}
              aria-pressed={groupBy === opt.key}
              className={`px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                groupBy === opt.key
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                  : 'text-surface-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Column chooser */}
        <div className="relative">
          <button
            onClick={() => setShowColumns(v => !v)}
            aria-expanded={showColumns}
            className="flex items-center gap-2 rounded-lg border border-surface-700 px-2.5 py-1.5 text-sm text-surface-300 transition-colors hover:border-surface-600 hover:text-white"
          >
            <Columns3 className="h-4 w-4" />
            Columns
          </button>

          {showColumns && (
            <>
              {/* A click anywhere else closes it, which is what a menu should
                  do and what Escape alone does not cover. */}
              <div className="fixed inset-0 z-10" onClick={() => setShowColumns(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-surface-700 bg-surface-800 p-2 shadow-xl">
                <p className="px-2 pb-1 text-xs uppercase tracking-wide text-surface-500">
                  Show these columns
                </p>
                {OPTIONAL_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-surface-200 hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
                <button
                  onClick={() => {
                    setVisibleColumns(DEFAULT_COLUMNS);
                    try {
                      localStorage.setItem('xantypsa.ticketColumns', JSON.stringify(DEFAULT_COLUMNS));
                    } catch {
                      // Nothing to do: the defaults are already applied.
                    }
                  }}
                  className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs text-brand-400 hover:bg-white/5"
                >
                  Reset to default
                </button>
              </div>
            </>
          )}
        </div>

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

      {groupBy === 'none' ? (
        <DataTable columns={columns} data={filtered} emptyMessage="No tickets found" onRowClick={(t: any) => router.push(`/service-desk/tickets/${t.id}`)} />
      ) : (
        <div className="space-y-6">
          {groups.length === 0 ? (
            <p className="text-sm text-surface-400">No tickets found</p>
          ) : groups.map(group => (
            <div key={group.label}>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-semibold text-surface-200">{group.label}</h3>
                <span className="text-xs text-surface-500">
                  {group.rows.length} {group.rows.length === 1 ? 'ticket' : 'tickets'}
                </span>
              </div>
              <DataTable columns={columns} data={group.rows} emptyMessage="None"
                onRowClick={(t: any) => router.push(`/service-desk/tickets/${t.id}`)} />
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Ticket" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create Ticket</Button></>}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Select label="Contact" value={form.contactId}
            onChange={(e: any) => setForm({ ...form, contactId: e.target ? e.target.value : e })}
            options={[
              { value: "", label: form.companyId ? "No contact" : "Choose a company first" },
              ...((contactsData?.items || []).map((c: any) => ({
                value: c.id,
                label: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Unnamed',
              }))),
            ]} />
          <Select label="Company" value={form.companyId}
            onChange={(e: any) => setForm({...form, companyId: e.target ? e.target.value : e, contractId: "", contactId: ""})}
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
