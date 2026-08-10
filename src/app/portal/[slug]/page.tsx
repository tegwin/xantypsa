// ============================================================
// Portal sign-in
// ============================================================
// The client's front door: /portal/<their-slug>.

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getPortalSession } from '@/lib/portal/session';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const company = await prisma.company.findFirst({
    where: { portalSlug: params.slug.toLowerCase(), portalEnabled: true },
    select: { name: true },
  });
  return { title: company ? `${company.name} — Support Portal` : 'Support Portal' };
}

export default async function PortalLoginPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { error?: string };
}) {
  const company = await prisma.company.findFirst({
    where: { portalSlug: params.slug.toLowerCase(), portalEnabled: true },
    select: { id: true, name: true },
  });

  // Same page for "no such portal" and "portal switched off", so the URL cannot
  // be used to discover which clients exist.
  if (!company) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="text-xl font-semibold text-white">Portal not found</h1>
        <p className="mt-2 text-sm text-slate-400">
          This address is not in use. Check the link you were given, or contact your IT provider.
        </p>
      </div>
    );
  }

  // Already signed in — skip the form.
  const session = await getPortalSession();
  if (session?.company.id === company.id) {
    redirect(`/portal/${params.slug}/tickets`);
  }

  const ERRORS: Record<string, string> = {
    expired: 'That sign-in link has expired or was already used. Request a new one below.',
    invalid: 'That sign-in link was not valid. Request a new one below.',
  };

  return (
    <div className="mx-auto max-w-md pt-12">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">{company.name}</h1>
        <p className="mt-1 text-sm text-slate-400">Support portal</p>
      </div>

      {searchParams.error && ERRORS[searchParams.error] && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {ERRORS[searchParams.error]}
        </div>
      )}

      <LoginForm slug={params.slug} />
    </div>
  );
}
