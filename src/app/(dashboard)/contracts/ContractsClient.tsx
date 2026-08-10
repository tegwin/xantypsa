"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Button, DataTable, Badge, SearchInput } from "@/components/ui";
import { Plus, FileText, Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Contract {
  id: string; contractNumber: string; name: string; type: string; status: string;
  company: string; value: number; currency: string; billingCycle: string;
  startDate: string; endDate: string; hoursIncluded: number; hoursUsed: number; autoRenew: boolean;
}

export default function ContractsClient({ contracts }: { contracts: Contract[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const filtered = contracts.filter(c => `${c.name} ${c.company} ${c.contractNumber}`.toLowerCase().includes(search.toLowerCase()));
  const columns = [
    { key: "contract", header: "Contract", render: (c: Contract) => (
      <div><p className="font-medium text-surface-100">{c.name}</p><p className="text-xs text-surface-500">{c.contractNumber}</p></div>
    )},
    { key: "company", header: "Company", render: (c: Contract) => <span className="text-surface-300">{c.company}</span> },
    { key: "type", header: "Type", render: (c: Contract) => <Badge>{c.type.replace(/_/g," ")}</Badge> },
    { key: "status", header: "Status", render: (c: Contract) => <Badge variant="status" status={c.status}>{c.status}</Badge> },
    { key: "value", header: "Value", render: (c: Contract) => <span className="font-medium text-surface-100">{formatCurrency(c.value,c.currency)}<span className="text-surface-500 text-xs">/{c.billingCycle}</span></span> },
    { key: "hours", header: "Hours", render: (c: Contract) => c.hoursIncluded > 0 ? (
      <div className="text-xs"><span className={c.hoursUsed > c.hoursIncluded ? "text-red-400" : "text-surface-300"}>{c.hoursUsed.toFixed(1)}</span><span className="text-surface-500">/{c.hoursIncluded}</span></div>
    ) : <span className="text-surface-600">—</span> },
    { key: "dates", header: "Period", render: (c: Contract) => <span className="text-xs text-surface-400">{formatDate(c.startDate)} → {c.endDate ? formatDate(c.endDate) : "Ongoing"}</span> },
    { key: "actions", header: "", render: (c: Contract) => (
      <button onClick={(e) => { e.stopPropagation(); router.push(`/contracts/${c.id}`); }}
        className="p-1.5 rounded-md hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors" title="View / Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    )},
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Contracts" description={`${contracts.length} contracts`}
        actions={<Button icon={<Plus className="h-4 w-4" />}>New Contract</Button>} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search contracts..." className="max-w-md" />
      <DataTable columns={columns} data={filtered} emptyMessage="No contracts found" onRowClick={(c: Contract) => router.push(`/contracts/${c.id}`)} />
    </div>
  );
}
