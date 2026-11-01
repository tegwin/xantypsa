'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

/**
 * Revenue minus every cost we know about: the burden rate of the engineers who
 * did the work, plus the wholesale cost of anything resold on a contract.
 */
export default function ProfitabilityPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const query = [from && `from=${from}`, to && `to=${to}`].filter(Boolean).join('&');
  const { data, loading } = useApi<any>(`/api/reports/profitability${query ? `?${query}` : ''}`);

  if (loading) return <LoadingSpinner />;

  const tam = data?.timeAndMaterials;
  const totals = data?.totals;
  const contracts = data?.contracts || [];

  const money = (n: number) => formatCurrency(n ?? 0);
  const profitClass = (n: number) => (n >= 0 ? 'text-green-400' : 'text-red-400');

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Profitability" subtitle="Revenue less engineer burden and resold service costs">
        <div className="flex items-end gap-2">
          <label className="text-xs text-surface-400">
            From
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="block bg-surface-800 border border-surface-700 rounded px-2 py-1 text-sm text-white" />
          </label>
          <label className="text-xs text-surface-400">
            To
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="block bg-surface-800 border border-surface-700 rounded px-2 py-1 text-sm text-white" />
          </label>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">Revenue</p>
          <p className="text-xl font-semibold text-white">{money(totals?.revenue)}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">All costs</p>
          <p className="text-xl font-semibold text-white">{money(totals?.totalCost)}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">Profit</p>
          <p className={`text-xl font-semibold ${profitClass(totals?.profit ?? 0)}`}>{money(totals?.profit)}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-xs text-surface-400">Margin</p>
          <p className="text-xl font-semibold text-white">{totals?.marginPercent ?? 0}%</p>
        </div>
      </div>

      {/* Time and materials */}
      <div className="glass-panel p-6 mb-6">
        <h3 className="text-white font-semibold mb-1">Time and materials</h3>
        <p className="text-sm text-surface-400 mb-4">
          Work with no contract to absorb it. Charged rate less the engineer's burden rate.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          <div><p className="text-xs text-surface-400">Hours</p><p className="text-white">{tam?.hours ?? 0}</p></div>
          <div><p className="text-xs text-surface-400">Avg charged</p><p className="text-white">{money(tam?.averageRate)}/hr</p></div>
          <div><p className="text-xs text-surface-400">Avg burden</p><p className="text-white">{money(tam?.averageBurden)}/hr</p></div>
          <div><p className="text-xs text-surface-400">Revenue</p><p className="text-white">{money(tam?.revenue)}</p></div>
          <div><p className="text-xs text-surface-400">Burden cost</p><p className="text-white">{money(tam?.labourCost)}</p></div>
          <div><p className="text-xs text-surface-400">Profit</p><p className={profitClass(tam?.profit ?? 0)}>{money(tam?.profit)}</p></div>
        </div>
        {tam?.incompleteCosting && (
          <p className="text-xs text-amber-400 mt-3">
            Some time was logged by an engineer with no burden rate set, so profit here is overstated.
          </p>
        )}
      </div>

      {/* Contracts */}
      <div className="glass-panel p-6">
        <h3 className="text-white font-semibold mb-4">Contracts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Profitability by contract</caption>
            <thead>
              <tr className="text-left text-xs text-surface-400 border-b border-surface-700">
                <th scope="col" className="py-2 pr-4">Contract</th>
                <th scope="col" className="py-2 pr-4">Company</th>
                <th scope="col" className="py-2 pr-4 text-right">Revenue</th>
                <th scope="col" className="py-2 pr-4 text-right">Hours</th>
                <th scope="col" className="py-2 pr-4 text-right">Burden</th>
                <th scope="col" className="py-2 pr-4 text-right">Services</th>
                <th scope="col" className="py-2 pr-4 text-right">Profit</th>
                <th scope="col" className="py-2 pr-4 text-right">Margin</th>
                <th scope="col" className="py-2 text-right">Break even</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c: any) => (
                <tr key={c.id} className="border-b border-surface-800">
                  <td className="py-2 pr-4 text-white">{c.name}</td>
                  <td className="py-2 pr-4 text-surface-400">{c.company || '-'}</td>
                  <td className="py-2 pr-4 text-right text-white">{money(c.revenue)}</td>
                  <td className="py-2 pr-4 text-right text-surface-300">{c.hours}</td>
                  <td className="py-2 pr-4 text-right text-surface-300">{money(c.labourCost)}</td>
                  <td className="py-2 pr-4 text-right text-surface-300">{money(c.serviceCost)}</td>
                  <td className={`py-2 pr-4 text-right ${profitClass(c.profit)}`}>{money(c.profit)}</td>
                  <td className="py-2 pr-4 text-right text-surface-300">{c.marginPercent}%</td>
                  <td className="py-2 text-right text-surface-300">
                    {c.breakEvenHours === null
                      ? 'No burden rate'
                      : `${c.breakEvenHours}h`}
                  </td>
                </tr>
              ))}
              {contracts.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-surface-500">No active contracts</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
