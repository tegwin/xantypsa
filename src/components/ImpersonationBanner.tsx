'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Shown across the top of every screen while impersonating.
 *
 * Deliberately loud and un-dismissable: the single worst outcome here is an
 * admin forgetting they are someone else and making changes on their behalf.
 */
export default function ImpersonationBanner({
  viewingAs,
  realName,
}: {
  viewingAs: string;
  realName: string;
}) {
  const [stopping, setStopping] = useState(false);

  const stop = async () => {
    setStopping(true);
    try {
      await fetch('/api/impersonate', { method: 'DELETE' });
      // Full reload rather than router.refresh() - the session is resolved
      // server-side from a cookie, so everything must be re-fetched.
      window.location.href = '/settings/users';
    } catch {
      setStopping(false);
    }
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-2 min-w-0 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="truncate">
          You are viewing Xanty PSA as <strong>{viewingAs}</strong>. Anything you do is recorded
          against {realName}.
        </span>
      </div>
      <button
        onClick={stop}
        disabled={stopping}
        className="shrink-0 bg-amber-950 text-amber-50 rounded-md px-3 py-1 text-sm font-medium hover:bg-amber-900 disabled:opacity-60"
      >
        {stopping ? 'Stopping…' : 'Stop impersonating'}
      </button>
    </div>
  );
}
