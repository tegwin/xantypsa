"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Button, Badge, SearchInput, Card, Modal, Input, Select, Textarea } from "@/components/ui";
import { Plus, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

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

  const active = initial.filter(d => !["won","lost"].includes(d.stage));
  const totalPipeline = active.reduce((a, d) => a + d.value, 0);

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
        // Store prospect info in customData
        payload.customData = {
          prospectName: form.prospectName,
          prospectEmail: form.prospectEmail,
          prospectPhone: form.prospectPhone,
        };
        // Also prepend prospect info to notes for visibility
        const prospectInfo = [
          form.prospectName && `Prospect: ${form.prospectName}`,
          form.prospectEmail && `Email: ${form.prospectEmail}`,
          form.prospectPhone && `Phone: ${form.prospectPhone}`,
        ].filter(Boolean).join('\n');
        if (prospectInfo) {
          payload.notes = prospectInfo + (form.notes ? '\n\n' + form.notes : '');
        }
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

      {/* Pipeline View */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto">
        {STAGES.filter(s => !["won","lost"].includes(s)).map(stage => {
          const stageItems = initial.filter(d => d.stage === stage);
          const stageTotal = stageItems.reduce((a, d) => a + d.value, 0);
          return (
            <div key={stage} className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-medium text-surface-300 capitalize">{stage}</h3>
                <span className="text-xs text-surface-500">{formatCurrency(stageTotal)}</span>
              </div>
              <div className="space-y-2 min-h-[100px]">
                {stageItems.map(opp => (
                  <Card key={opp.id} hover className="!p-3 cursor-pointer" onClick={() => router.push(`/crm/opportunities/${opp.id}`)}>
                    <p className="text-sm font-medium text-surface-100 truncate">{opp.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{opp.company || "No company"}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold text-brand-400">{formatCurrency(opp.value)}</span>
                      <span className="text-xs text-surface-500">{opp.probability}%</span>
                    </div>
                  </Card>
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
            <Input label="Value" type="number" value={form.value} onChange={update("value")} />
            <Input label="Probability (%)" type="number" min="0" max="100" value={form.probability} onChange={update("probability")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Stage" value={form.stage} onChange={update("stage")} options={STAGES.map(s => ({value:s,label:s.charAt(0).toUpperCase()+s.slice(1)}))} />
            <Select label="Source" value={form.source} onChange={update("source")}
              options={[{ value: "", label: "-- Select source --" }, ...SOURCES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ') }))]} />
          </div>
          <Input label="Expected Close Date" type="date" value={form.expectedClose} onChange={update("expectedClose")} />
          <Textarea label="Notes" value={form.notes} onChange={update("notes")} placeholder="Any additional notes..." />
        </form>
      </Modal>
    </div>
  );
}
