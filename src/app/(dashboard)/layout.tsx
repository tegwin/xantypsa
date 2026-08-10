// Every screen here resolves a session from cookies, so none of it can be
// statically prerendered. Declaring it explicitly stops the build attempting to.
export const dynamic = 'force-dynamic';

import { getAppSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import AiPanel from '@/components/ai/AiPanel';
import ImpersonationBanner from '@/components/ImpersonationBanner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect('/login');

  // Two-factor policy. Read from the database, not from anything the client
  // controls: middleware can enforce the TOTP *challenge* (Supabase guarantees
  // that cryptographically via assurance levels) but only the server knows
  // whether an admin has required enrolment in the first place.
  if (session.user.mfaRequired && !session.impersonatedBy) {
    const supabase = await createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const enrolled = factors?.totp?.some((f) => f.status === 'verified');
    if (!enrolled) redirect('/setup-2fa');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {session.impersonatedBy && (
          <ImpersonationBanner
            viewingAs={session.user.name}
            realName={session.impersonatedBy.name}
          />
        )}
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto animate-fade-in">{children}</div>
        </main>
      </div>
      {/* Mounted once so the assistant is present on every screen and derives
          its context (tickets, contracts, opportunities…) from the URL. */}
      <AiPanel />
    </div>
  );
}
