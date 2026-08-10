'use client';

import { SessionProvider } from '@/components/SessionProvider';
import type { AppSession } from '@/lib/session';
import { Toaster } from 'react-hot-toast';

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AppSession | null;
}) {
  return (
    <SessionProvider session={session}>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#e2e8f0',
            border: '1px solid #334155',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#1e293b' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
        }}
      />
      {children}
    </SessionProvider>
  );
}
