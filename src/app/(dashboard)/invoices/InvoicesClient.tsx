"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Button, DataTable, Badge, SearchInput, Tabs, StatsCard, Card } from "@/components/ui";
import { Plus, CreditCard, AlertTriangle, CheckCircle2, Clock, Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Invoice { id: string; invoiceNumber: string; title: string; status: string; total: number; amountPaid: number; amountDue: number; currency: string; company: string; dueDate: string; issueDate: string; isRecurring: boolean; }

export default function InvoicesClient({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const totalOutstanding = invoices.filter(i=>["sent","partial","overdue"].includes(i.status)).reduce((a,i)=>a+i.amountDue,0);
  const totalOverdue = invoices.filter(i=>i.status==="overdue").reduce((a,i)=>a+i.amountDue,0);
  const totalPaid = invoices.filter(i=>i.status==="paid").reduce((a,i)=>a+i.total,0);

  const filtered = invoices.filter(i => {
    const matchesSearch = `${i.invoiceNumber} ${i.title} ${i.company}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === "all" || i.status === status);
  });

  const tabs = ["all","draft","sent","partial","paid","overdue","void"].map(s => ({
    id: s, label: s === "all" ? "All" : s.charAt(0).toUpperCase()+s.slice(1),
    count: s === "all" ? invoices.length : invoices.filter(i=>i.status===s).length,
  }));

  const columns = [
    { key: "inv", header: "Invoice", render: (i: Invoice) => (<div><p className="font-medium text-surface-100">{i.invoiceNumber}</p>{i.title && <p className="text-xs text-surface-500">{i.title}</p>}</div>) },
    { key: "company", header: "Company", render: (i: Invoice) => <span className="text-surface-300">{i.company || "—"}</span> },
    { key: "status", header: "Status", render: (i: Invoice) => <Badge variant="status" status={i.status}>{i.status}</Badge> },
    { key: "total", header: "Total", render: (i: Invoice) => <span className="font-medium text-surface-100">{formatCurrency(i.total, i.currency)}</span> },
    { key: "due", header: "Amount Due", render: (i: Invoice) => <span className={i.amountDue > 0 ? "font-medium text-amber-400" : "text-green-400"}>{formatCurrency(i.amountDue, i.currency)}</span> },
    { key: "dueDate", header: "Due Date", render: (i: Invoice) => {
      const overdue = new Date(i.dueDate) < new Date() && i.status !== "paid";
      return <span className={`text-xs ${overdue ? "text-red-400" : "text-surface-400"}`}>{formatDate(i.dueDate)}</span>;
    }},
    { key: "recurring", header: "", render: (i: Invoice) => i.isRecurring ? <Badge>Recurring</Badge> : null },
    { key: "actions", header: "", render: (i: Invoice) => (
      <button onClick={(e) => { e.stopPropagation(); router.push(`/invoices/${i.id}`); }}
        className="p-1.5 rounded-md hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="View / Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" actions={<Button icon={<Plus className="h-4 w-4" />}>New Invoice</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Outstanding" value={formatCurrency(totalOutstanding)} icon={<Clock className="h-5 w-5" />} />
        <StatsCard title="Overdue" value={formatCurrency(totalOverdue)} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatsCard title="Paid (All Time)" value={formatCurrency(totalPaid)} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>
      <Tabs tabs={tabs} active={status} onChange={setStatus} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search invoices..." className="max-w-md" />
      <DataTable columns={columns} data={filtered} emptyMessage="No invoices found" onRowClick={(i: Invoice) => router.push(`/invoices/${i.id}`)} />
    </div>
  );
}
