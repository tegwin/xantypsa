'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface QuotesTabProps {
  company: any;
}

export default function QuotesTab({ company }: QuotesTabProps) {
  const router = useRouter();
  const quotes = company.quotes || [];

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-semibold">Quotes ({quotes.length})</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push(`/quotes/builder?companyId=${company.id}`)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-3.5 h-3.5" /> New Quote
          </button>
          <Link href={`/quotes/list?companyId=${company.id}`} className="text-sm text-brand-400 hover:text-brand-300">View all →</Link>
        </div>
      </div>
      {quotes.length > 0 ? (
        <div className="space-y-2">
          {quotes.map((q: any) => (
            <Link key={q.id} href={`/quotes/${q.id}`}
              className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-400">{q.quoteNumber}</span>
                <span className="text-white text-sm">{q.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">{formatCurrency(q.total)}</span>
                <StatusBadge status={q.status} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No quotes yet</p>
      )}
    </div>
  );
}
