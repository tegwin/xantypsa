'use client';

// ============================================================
// Client-side session
// ============================================================
// Deliberately mirrors NextAuth's useSession() shape ({ data, status }) so the
// components that consumed it needed only an import change.
//
// The session is resolved once on the server and passed down, rather than each
// component fetching it — no request waterfall, and no flash of signed-out UI.

import { createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import type { AppSession } from '@/lib/session';

type SessionState = {
  data: AppSession | null;
  status: 'authenticated' | 'unauthenticated';
  /** NextAuth exposed this to force a refetch; re-rendering from the server does it here. */
  update: () => void;
};

const SessionContext = createContext<SessionState>({
  data: null,
  status: 'unauthenticated',
  update: () => {},
});

export function SessionProvider({
  session,
  children,
}: {
  session: AppSession | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <SessionContext.Provider
      value={{
        data: session,
        status: session ? 'authenticated' : 'unauthenticated',
        update: () => router.refresh(),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}

/** Sign out and return to the login screen. */
export async function signOut(options?: { callbackUrl?: string }) {
  await fetch('/api/auth/signout', { method: 'POST' });
  // Full reload rather than a router push, so no server-rendered fragment of
  // the previous session survives in the client cache.
  window.location.href = options?.callbackUrl ?? '/login';
}
