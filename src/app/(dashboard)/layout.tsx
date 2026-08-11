// Every screen here resolves a session from cookies, so none of it can be
// statically prerendered. Declaring it explicitly stops the build attempting to.
export const dynamic = 'force-dynamic';

import { getAppSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import AiPanel from '@/components/ai/AiPanel';
import ImpersonationBanner from '@/components/ImpersonationBanner';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  if (!session) redirect('/login');

  // Two-factor policy. Read from the database, never from anything the client
  // controls. Middleware enforces the *challenge* (the mfa flag lives inside a
  // signed cookie it cannot forge); this enforces *enrolment*, which only the
  // server knows an admin has mandated.
  if (session.user.mfaRequired && !session.impersonatedBy) {
    const { totpSecret } = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { totpSecret: true },
    });
    if (!totpSecret) redirect('/setup-2fa');
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
