'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { PageHeader, DataTable, StatusBadge, Pagination, EmptyState, LoadingSpinner } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function QuotesPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { data, loading } = useApi<any>(`/api/quotes?page=${page}&search=${search}&status=${statusFilter}&limit=25`);

  const statuses = [
    { value: '', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'viewed', label: 'Viewed' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'declined', label: 'Rejected' },
    { value: 'expired', label: 'Expired' },
    { value: 'converted', label: 'Converted' },
  ];

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Quotes" subtitle="Create and manage quotes">
        <button onClick={() => router.push('/quotes/builder')} className="btn-primary">+ New Quote</button>
      </PageHeader>

      <div className="glass rounded-xl p-6">
        <div className="flex flex-wrap gap-3 mb-4">
          <input type="text" placeholder="Search quotes..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input w-full max-w-md" />
          <div className="flex gap-2 flex-wrap">
            {statuses.map(s => (
              <button key={s.value} onClick={() => { setStatusFilter(s.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${statusFilter === s.value ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <LoadingSpinner /> : !data?.items?.length ? (
          <EmptyState title="No quotes found" description="Create your first quote" actionLabel="New Quote" onAction={() => router.push('/quotes/builder')} />
        ) : (
          <>
            <DataTable
              columns={[
                { key: 'quoteNumber', label: 'Number', render: (r: any) => (
                  <Link href={`/quotes/${r.id}`} className="text-blue-400 hover:text-blue-300 font-mono">{r.quoteNumber}</Link>
                )},
                { key: 'title', label: 'Title', render: (r: any) => <span className="text-white font-medium">{r.title}</span> },
                { key: 'company', label: 'Company', render: (r: any) => r.company?.name || '\u2014' },
                { key: 'status', label: 'Status', render: (r: any) => <StatusBadge status={r.status} /> },
                { key: 'total', label: 'Total', render: (r: any) => <span className="font-semibold text-white">{formatCurrency(r.total)}</span> },
                { key: 'validUntil', label: 'Valid Until', render: (r: any) => (
                  <span className={r.validUntil && new Date(r.validUntil) < new Date() ? 'text-red-400' : 'text-slate-400'}>
                    {r.validUntil ? formatDate(r.validUntil) : '\u2014'}
                  </span>
                )},
                { key: 'createdAt', label: 'Created', render: (r: any) => <span className="text-slate-400 text-sm">{formatDate(r.createdAt)}</span> },
              ]}
              data={data.items}
            />
            <Pagination currentPage={page} totalPages={data.pages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
