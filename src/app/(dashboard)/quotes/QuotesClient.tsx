"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Button, DataTable, Badge, SearchInput, Tabs } from "@/components/ui";
import { Plus, Receipt, Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Quote { id: string; quoteNumber: string; title: string; status: string; total: number; currency: string; company: string; createdBy: string; validUntil: string; createdAt: string; }

export default function QuotesClient({ quotes }: { quotes: Quote[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = quotes.filter(q => {
    const matchesSearch = `${q.quoteNumber} ${q.title} ${q.company}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === "all" || q.status === status);
  });
  const tabs = ["all","draft","sent","viewed","accepted","declined","expired"].map(s => ({
    id: s, label: s === "all" ? "All" : s.charAt(0).toUpperCase()+s.slice(1),
    count: s === "all" ? quotes.length : quotes.filter(q=>q.status===s).length,
  }));
  const columns = [
    { key: "quote", header: "Quote", render: (q: Quote) => (<div><p className="font-medium text-surface-100">{q.title}</p><p className="text-xs text-surface-500">{q.quoteNumber}</p></div>) },
    { key: "company", header: "Company", render: (q: Quote) => <span className="text-surface-300">{q.company || "—"}</span> },
    { key: "status", header: "Status", render: (q: Quote) => <Badge variant="status" status={q.status}>{q.status}</Badge> },
    { key: "total", header: "Total", render: (q: Quote) => <span className="font-medium text-surface-100">{formatCurrency(q.total, q.currency)}</span> },
    { key: "validUntil", header: "Valid Until", render: (q: Quote) => <span className="text-xs text-surface-400">{q.validUntil ? formatDate(q.validUntil) : "—"}</span> },
    { key: "createdBy", header: "Created By", render: (q: Quote) => <span className="text-surface-400 text-xs">{q.createdBy}</span> },
    { key: "actions", header: "", render: (q: Quote) => (
      <button onClick={(e) => { e.stopPropagation(); router.push(`/quotes/${q.id}`); }}
        className="p-1.5 rounded-md hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="View / Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    )},
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Quotes" description={`${quotes.length} total quotes`} actions={<Button icon={<Plus className="h-4 w-4" />}>New Quote</Button>} />
      <Tabs tabs={tabs} active={status} onChange={setStatus} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search quotes..." className="max-w-md" />
      <DataTable columns={columns} data={filtered} emptyMessage="No quotes found" onRowClick={(q: Quote) => router.push(`/quotes/${q.id}`)} />
    </div>
  );
}
