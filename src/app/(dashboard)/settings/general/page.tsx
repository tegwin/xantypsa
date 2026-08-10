'use client';

import { useState } from 'react';
import { useSession } from '@/components/SessionProvider';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import toast from 'react-hot-toast';

export default function SettingsGeneralPage() {
  const { data: session } = useSession();
  const [form, setForm] = useState({
    name: session?.user?.tenantName || '',
    defaultCurrency: 'GBP',
    defaultTaxRate: '20',
    timezone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
  });

  const handleSave = async () => {
    toast.success('Settings saved');
  };

  return (
    <div className="animate-fadeIn">
      <PageHeader title="General Settings" subtitle="Configure your workspace" />

      <div className="max-w-2xl space-y-6">
        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Organisation</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Company Name</label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Default Currency</label>
                <select className="input w-full" value={form.defaultCurrency} onChange={(e) => setForm({...form, defaultCurrency: e.target.value})}>
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="ZAR">ZAR (R)</option>
                </select>
              </div>
              <div>
                <label className="label">Default Tax Rate (%)</label>
                <input className="input w-full" type="number" value={form.defaultTaxRate} onChange={(e) => setForm({...form, defaultTaxRate: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Timezone</label>
                <select className="input w-full" value={form.timezone} onChange={(e) => setForm({...form, timezone: e.target.value})}>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New York</option>
                  <option value="America/Los_Angeles">America/Los Angeles</option>
                  <option value="Africa/Johannesburg">Africa/Johannesburg</option>
                </select>
              </div>
              <div>
                <label className="label">Date Format</label>
                <select className="input w-full" value={form.dateFormat} onChange={(e) => setForm({...form, dateFormat: e.target.value})}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Subscription</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Plan</span><span className="text-white capitalize">{session?.user?.tenantPlan || 'trial'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Slug</span><span className="text-white font-mono">{session?.user?.tenantSlug}</span></div>
          </div>
        </div>

        <button onClick={handleSave} className="btn-primary">Save Settings</button>
      </div>
    </div>
  );
}
