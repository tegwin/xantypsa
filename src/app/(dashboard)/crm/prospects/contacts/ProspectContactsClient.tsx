'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader, SearchInput, EmptyState } from '@/components/ui';
import { Users } from 'lucide-react';

interface ProspectContact {
  id: string; name: string; email: string; phone: string;
  jobTitle: string; companyId: string | null; companyName: string; createdAt: string;
}

export default function ProspectContactsClient({ contacts }: { contacts: ProspectContact[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = contacts.filter(c =>
    !search ||
    `${c.name} ${c.email} ${c.companyName}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Prospect contacts" subtitle="People at companies that are still prospects">
        <button onClick={() => router.push('/crm/prospects')} className="btn-secondary text-sm">
          Prospects
        </button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search prospect contacts" />
        <span className="text-sm text-surface-400">
          {filtered.length} contact{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No prospect contacts"
          description="People added to a prospect appear here, and move to the main contact list when that prospect becomes a customer."
        />
      ) : (
        <div className="glass-panel p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Contacts at prospects</caption>
            <thead>
              <tr className="text-left text-xs text-surface-400 border-b border-surface-700">
                <th scope="col" className="py-3 px-4">Name</th>
                <th scope="col" className="py-3 px-4">Prospect</th>
                <th scope="col" className="py-3 px-4">Job title</th>
                <th scope="col" className="py-3 px-4">Email</th>
                <th scope="col" className="py-3 px-4">Phone</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-surface-800 hover:bg-white/5">
                  <td className="py-3 px-4">
                    <Link href={`/crm/contacts/${c.id}`} className="text-white hover:text-brand-400">
                      {c.name || 'Unnamed'}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    {c.companyId
                      ? <Link href={`/crm/companies/${c.companyId}`} className="text-brand-400 hover:text-brand-300">{c.companyName}</Link>
                      : <span className="text-surface-500">-</span>}
                  </td>
                  <td className="py-3 px-4 text-surface-400">{c.jobTitle || '-'}</td>
                  <td className="py-3 px-4 text-surface-400">{c.email || '-'}</td>
                  <td className="py-3 px-4 text-surface-400">{c.phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
