"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Button, Badge, SearchInput, Card, Modal, Input, Select, Textarea } from "@/components/ui";
import { Plus, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import { useBoardDnd } from "@/components/board/useBoardDnd";

interface Opportunity {
  id: string; title: string; value: number; currency: string; stage: string; probability: number;
  company: string; contact: string; owner: string; expectedClose: string; createdAt: string;
}

const STAGES = ["lead","qualified","proposal","negotiation","won","lost"];
const SOURCES = ["web","referral","cold-call","email","event","partner","other"];

export default function OpportunitiesClient({ opportunities: initial, companies = [] }: { opportunities: Opportunity[]; companies?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [customerType, setCustomerType] = useState<'existing' | 'prospect'>('existing');
  const [form, setForm] = useState({
    title: "", value: "0", stage: "lead", probability: "10", companyId: "",
    source: "", notes: "", expectedClose: "",
    prospectName: "", prospectEmail: "", prospectPhone: "",
  });
  const [saving, setSaving] = useState(false);
  // Stage a deal has been dragged to but the server has not confirmed yet.
  const [pending, setPending] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("active");
  // The tenant's own pipeline. STAGES below is only the fallback.
  const [stageDefs, setStageDefs] = useState<any[]>([]);
  // Which fields this tenant insists on, so the form can mark them.
  const [required, setRequired] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/pipeline-stages")
      .then(r => r.json())
      .then(d => setStageDefs((d.items || []).filter((x: any) => x.isActive)))
      .catch(() => {});
    fetch("/api/settings/crm")
      .then(r => r.json())
      .then(d => setRequired(d.required || {}))
      .catch(() => {});
  }, []);

  const stageOf = (d: Opportunity) => pending[d.id] ?? d.stage;

  async function handleStageChange(oppId: string, newStage: string) {
    setPending(p => ({ ...p, [oppId]: newStage }));
    try {
      const res = await fetch(`/api/opportunities/${oppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("That opportunity could not be moved. It has been put back.");
    } finally {
      setPending(p => {
        const next = { ...p };
        delete next[oppId];
        return next;
      });
    }
  }

  const { cardProps, columnProps, draggingId, overColumn } = useBoardDnd((oppId, toStage) => {
    const opp = initial.find(d => d.id === oppId);
    if (opp && stageOf(opp) !== toStage) handleStageChange(oppId, toStage);
  });

  // A star marks a field this tenant insists on.
  const star = (field: string, label: string) => (required[field] ? `${label} *` : label);

  const stageList: { slug: string; name: string; isWon?: boolean; isLost?: boolean }[] =
    stageDefs.length > 0
      ? stageDefs.map((s: any) => ({ slug: s.slug, name: s.name, isWon: s.isWon, isLost: s.isLost }))
      : STAGES.map(s => ({
          slug: s,
          name: s.charAt(0).toUpperCase() + s.slice(1),
          isWon: s === "won",
          isLost: s === "lost",
        }));

  const isClosedStage = (slug: string) => {
    const def = stageList.find(s => s.slug === slug);
    return !!(def?.isWon || def?.isLost);
  };

  const matchesSearch = (d: Opportunity) =>
    !search ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    (d.company || "").toLowerCase().includes(search.toLowerCase());

  const searched = initial.filter(matchesSearch);
  const active = searched.filter(d => !isClosedStage(stageOf(d)));
  const totalPipeline = active.reduce((a, d) => a + d.value, 0);

  // Active first, then one tab per stage, the same shape as the ticket list.
  const tabs = [
    { key: "active", label: "Active", count: active.length },
    ...stageList.map(s => ({
      key: s.slug,
      label: s.name,
      count: searched.filter(d => stageOf(d) === s.slug).length,
    })),
  ];

  // The board shows every stage on Active, or just the one a tab selects.
  const visibleStages = tab === "active" ? stageList : stageList.filter(s => s.slug === tab);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const payload: any = {
        title: form.title,
        value: parseFloat(form.value),
        stage: form.stage,
        probability: parseInt(form.probability),
        source: form.source || null,
        notes: form.notes || null,
        expectedClose: form.expectedClose || null,
      };

      if (customerType === 'existing') {
        payload.companyId = form.companyId || null;
      } else {
        // The server turns these into a real prospect company, and a contact
        // on it, so the lead shows up under CRM, Prospects.
        payload.prospectName = form.prospectName;
        payload.prospectEmail = form.prospectEmail || null;
        payload.prospectPhone = form.prospectPhone || null;
      }

      const res = await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Opportunity created"); setShowModal(false); router.refresh();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  }

  const update = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const resetForm = () => {
    setForm({ title: "", value: "0", stage: "lead", probability: "10", companyId: "", source: "", notes: "", expectedClose: "", prospectName: "", prospectEmail: "", prospectPhone: "" });
    setCustomerType('existing');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Opportunities" description={`${active.length} active · ${formatCurrency(totalPipeline)} pipeline`}
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { resetForm(); setShowModal(true); }}>New Opportunity</Button>} />

      {/* Stage tabs and search, matching the ticket list */}
      <div>
        <div className="flex items-center gap-1 overflow-x-auto border-b border-surface-700">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? "border-brand-500 text-white"
                  : "border-transparent text-surface-400 hover:text-surface-200"
              }`}
            >
              {t.label}
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-surface-300">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search opportunities" />
        </div>
      </div>

      {/* Pipeline View */}
      <div className={`grid grid-cols-1 gap-4 overflow-x-auto ${
        visibleStages.length === 1 ? "" : "md:grid-cols-3 xl:grid-cols-6"
      }`}>
        {visibleStages.map(stageDef => {
          const stage = stageDef.slug;
          const stageItems = searched.filter(d => stageOf(d) === stage);
          const stageTotal = stageItems.reduce((a, d) => a + d.value, 0);
          return (
            <div
              key={stage}
              {...columnProps(stage)}
              className={`space-y-3 rounded-lg p-1 transition-shadow ${
                overColumn === stage ? "ring-2 ring-brand-400" : ""
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-medium text-surface-300">{stageDef.name}</h3>
                <span className="text-xs text-surface-500">{formatCurrency(stageTotal)}</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {stageItems.map(opp => (
                  // The drag handlers live on a wrapper so the Card component
                  // does not need to forward DOM props.
                  <div
                    key={opp.id}
                    {...cardProps(opp.id)}
                    className={draggingId === opp.id ? "opacity-40" : undefined}
                  >
                    <Card hover className="!p-3 cursor-grab active:cursor-grabbing" onClick={() => router.push(`/crm/opportunities/${opp.id}`)}>
                      <p className="text-sm font-medium text-surface-100 truncate">{opp.title}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{opp.company || "No company"}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold text-brand-400">{formatCurrency(opp.value)}</span>
                        <span className="text-xs text-surface-500">{opp.probability}%</span>
                      </div>
                      <select
                        value={stageOf(opp)}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); handleStageChange(opp.id, e.target.value); }}
                        aria-label={`Stage for ${opp.title}`}
                        className="mt-2 w-full text-xs bg-white/5 border border-white/10 rounded px-1.5 py-1 text-surface-300 capitalize focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {stageList.map(st => <option key={st.slug} value={st.slug}>{st.name}</option>)}
                      </select>
                    </Card>
                  </div>
                ))}
                {stageItems.length === 0 && <div className="border-2 border-dashed border-surface-700/50 rounded-lg p-4 text-center text-xs text-surface-600">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Opportunity"
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button loading={saving} onClick={handleCreate}>Create</Button></>}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Opportunity Title" value={form.title} onChange={update("title")} required placeholder="e.g. Office 365 Migration" />

          {/* Customer Type Toggle */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Customer Type</label>
            <div className="flex gap-2">
              <button type="button"
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${customerType === 'existing' ? 'bg-brand-600 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
                onClick={() => setCustomerType('existing')}>
                Existing Customer
              </button>
              <button type="button"
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${customerType === 'prospect' ? 'bg-brand-600 text-white' : 'bg-surface-700 text-surface-300 hover:bg-surface-600'}`}
                onClick={() => setCustomerType('prospect')}>
                New Prospect
              </button>
            </div>
          </div>

          {customerType === 'existing' ? (
            <Select label="Company" value={form.companyId} onChange={update("companyId")}
              options={[{ value: "", label: "-- Select company --" }, ...companies.map(c => ({ value: c.id, label: c.name }))]} />
          ) : (
            <div className="space-y-3 p-3 rounded-lg border border-surface-600 bg-surface-800/50">
              <p className="text-xs text-surface-400 font-medium uppercase tracking-wide">Prospect Details</p>
              <Input label="Prospect Name" value={form.prospectName} onChange={update("prospectName")} placeholder="Company or person name" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email" type="email" value={form.prospectEmail} onChange={update("prospectEmail")} placeholder="email@example.com" />
                <Input label="Phone" value={form.prospectPhone} onChange={update("prospectPhone")} placeholder="+44..." />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label={star('value', 'Value')} type="number" value={form.value} onChange={update("value")} />
            <Input label={star('probability', 'Probability (%)')} type="number" min="0" max="100" value={form.probability} onChange={update("probability")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Stage" value={form.stage} onChange={update("stage")} options={stageList.map(s => ({ value: s.slug, label: s.name }))} />
            <Select label={star('source', 'Source')} value={form.source} onChange={update("source")}
              options={[{ value: "", label: "-- Select source --" }, ...SOURCES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ') }))]} />
          </div>
          <Input label={star('expectedClose', 'Expected Close Date')} type="date" value={form.expectedClose} onChange={update("expectedClose")} />
          <Textarea label="Notes" value={form.notes} onChange={update("notes")} placeholder="Any additional notes..." />
        </form>
      </Modal>
    </div>
  );
}
