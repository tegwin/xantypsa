'use client';

import { useApi } from '@/hooks/useApi';
import { formatRelativeTime } from '@/lib/utils';
import { Activity } from 'lucide-react';

interface ActivityLogTabProps {
  company: any;
}

export default function ActivityLogTab({ company }: ActivityLogTabProps) {
  const { data, loading } = useApi<any>(`/api/audit-logs?entityType=company&entityId=${company.id}`);
  const logs = data?.items || [];

  if (loading) return <div className="text-center py-8 text-slate-400">Loading activity...</div>;

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-white font-semibold mb-4">Activity Log</h3>
      {logs.length > 0 ? (
        <div className="space-y-3">
          {logs.map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 bg-white/5 rounded-lg p-3">
              <Activity className="w-4 h-4 text-slate-400 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">{log.user?.name || 'System'}</span>
                  <span className="text-xs text-slate-400">{log.action}</span>
                  <span className="text-xs text-slate-500">{log.entityType}</span>
                </div>
                {log.changes && Object.keys(log.changes).length > 0 && (
                  <div className="mt-1 text-xs text-slate-400">
                    {Object.entries(log.changes).map(([key, value]) => (
                      <span key={key} className="mr-3">{key}: {String(value)}</span>
                    ))}
                  </div>
                )}
                <span className="text-xs text-slate-600">{formatRelativeTime(log.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-8">No activity recorded yet</p>
      )}
    </div>
  );
}
