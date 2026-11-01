'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, SearchInput, Badge, EmptyState } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { UserPlus, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface Prospect {
  id: string; name: string; industry: string; phone: string; email: string;
  website: string; city: string; isActive: boolean;
  contacts: number; opportunities: number; pipelineValue: number; createdAt: string;
}

export default function ProspectsClient({ prospects }: { prospects: Prospect[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [converting, setConverting] = useState<string | null>(null);

  const filtered = prospects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPipeline = filtered.reduce((a, p) => a + p.pipelineValue, 0);

  // Converting is a change of type on the same record, so contacts, tickets
  // and opportunities all carry over untouched.
  const convert = async (p: Prospect) => {
    if (!confirm(`Convert ${p.name} to a customer?`)) return;
    setConverting(p.id);
    try {
      const res = await fetch(`/api/companies/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'customer' }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not convert');
      toast.success(`${p.name} is now a customer`);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setConverting(null);
    }
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Prospects" subtitle="Companies that have not become customers yet">
        <button onClick={() => router.push('/crm/companies')} className="btn-secondary text-sm">
          Customers
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search prospects" />
        <span className="text-sm text-surface-400">
          {filtered.length} prospect{filtered.length === 1 ? '' : 's'}, {formatCurrency(totalPipeline)} in pipeline
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="No prospects"
          description="A company created as a prospect appears here until you convert it to a customer."
        />
      ) : (
        <div className="glass-panel p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Prospects</caption>
            <thead>
              <tr className="text-left text-xs text-surface-400 border-b border-surface-700">
                <th scope="col" className="py-3 px-4">Name</th>
                <th scope="col" className="py-3 px-4">Industry</th>
                <th scope="col" className="py-3 px-4">City</th>
                <th scope="col" className="py-3 px-4 text-right">Contacts</th>
                <th scope="col" className="py-3 px-4 text-right">Opportunities</th>
                <th scope="col" className="py-3 px-4 text-right">Pipeline</th>
                <th scope="col" className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-surface-800 hover:bg-white/5">
                  <td className="py-3 px-4">
                    <button onClick={() => router.push(`/crm/companies/${p.id}`)}
                      className="text-white hover:text-brand-400">{p.name}</button>
                    {!p.isActive && <Badge variant="default">inactive</Badge>}
                  </td>
                  <td className="py-3 px-4 text-surface-400">{p.industry || '-'}</td>
                  <td className="py-3 px-4 text-surface-400">{p.city || '-'}</td>
                  <td className="py-3 px-4 text-right text-surface-300">{p.contacts}</td>
                  <td className="py-3 px-4 text-right text-surface-300">{p.opportunities}</td>
                  <td className="py-3 px-4 text-right text-white">{formatCurrency(p.pipelineValue)}</td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => convert(p)} disabled={converting === p.id}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border border-green-500/40 text-green-300 hover:bg-green-500/10 disabled:opacity-50">
                      {converting === p.id ? 'Converting...' : <>Convert to customer <ArrowRight className="h-3 w-3" /></>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
