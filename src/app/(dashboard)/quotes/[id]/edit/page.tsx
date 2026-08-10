'use client';

import { useParams } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { LoadingSpinner } from '@/components/ui';
import QuoteBuilder from '../../builder/QuoteBuilder';

export default function EditQuotePage() {
  const params = useParams();
  const { data, loading } = useApi<any>(`/api/quotes/${params.id}`);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner /></div>;
  if (!data) return <div className="text-center py-20 text-slate-400">Quote not found</div>;

  return <QuoteBuilder initialData={data} />;
}
