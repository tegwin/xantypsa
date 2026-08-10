// ============================================================
// Application session
// ============================================================
// Supabase owns authentication (who you are); the app database owns
// authorisation (which tenant, which role, which permissions).
//
// This returns the *same shape* NextAuth produced, so every existing API route
// and page keeps working — the swap is confined to this file and lib/api.ts.

import { cache } from 'react';
import { createClient } from './supabase/server';
import { prisma } from './prisma';
import { readImpersonation } from './impersonation';

export interface AppSession {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string | null;
    isSuperAdmin: boolean;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    tenantPlan: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    supabaseId: string;
    /** Admin policy: this user must enrol in two-factor before using the app. */
    mfaRequired: boolean;
  };
  /**
   * Set only while an admin is impersonating someone. `user` is the person
   * being viewed as; this is who is actually driving. Present so the UI can
   * warn and so writes remain attributable to a real person.
   */
  impersonatedBy?: { id: string; name: string; email: string };
}

/**
 * Resolve the signed-in user.
 *
 * `cache()` dedupes this per request, so a page plus the API calls it triggers
 * don't each re-query Supabase and Postgres.
 */
export const getAppSession = cache(async (): Promise<AppSession | null> => {
  const supabase = await createClient();

  // getUser() revalidates against Supabase; getSession() trusts the cookie and
  // must not be used for authorisation decisions.
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser?.email) return null;

  // Link by supabaseId where present, falling back to email so users created
  // before the migration still resolve on their first sign-in.
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ supabaseId: authUser.id }, { email: authUser.email.toLowerCase() }],
      isActive: true,
    },
    include: {
      tenants: {
        include: {
          tenant: { select: { id: true, name: true, slug: true, plan: true } },
          role: { select: { id: true, name: true, permissions: true } },
        },
      },
    },
  });

  if (!user) return null;

  // Backfill the link so subsequent lookups hit the indexed id.
  if (!user.supabaseId) {
    await prisma.user
      .update({ where: { id: user.id }, data: { supabaseId: authUser.id } })
      .catch(() => undefined); // a race here is harmless
  }

  // An admin may be viewing the app as someone else. Resolve the real user
  // first (above) so the privilege check below is against *their* rights, never
  // the target's — otherwise impersonating an admin would escalate privilege.
  const impersonation = await readImpersonation();
  let effectiveUser = user;
  let impersonatedBy: AppSession['impersonatedBy'];

  if (impersonation && impersonation.realUserId === user.id) {
    const canImpersonate =
      user.isSuperAdmin ||
      user.tenants.some((t) => t.isOwner);

    if (canImpersonate) {
      const target = await prisma.user.findFirst({
        where: {
          id: impersonation.targetUserId,
          isActive: true,
          // Confined to the admin's own tenants — impersonation must never
          // cross a tenant boundary.
          tenants: { some: { tenantId: { in: user.tenants.map((t) => t.tenantId) } } },
        },
        include: {
          tenants: {
            include: {
              tenant: { select: { id: true, name: true, slug: true, plan: true } },
              role: { select: { id: true, name: true, permissions: true } },
            },
          },
        },
      });

      if (target) {
        impersonatedBy = { id: user.id, name: user.name, email: user.email };
        effectiveUser = target;
      }
    }
  }

  const membership = effectiveUser.tenants[0];
  if (!membership) return null;

  const permissions = Array.isArray(membership.role?.permissions)
    ? (membership.role.permissions as string[])
    : [];

  return {
    impersonatedBy,
    user: {
      id: effectiveUser.id,
      email: effectiveUser.email,
      name: effectiveUser.name,
      avatar: effectiveUser.avatar ?? null,
      // While impersonating, never inherit super-admin from the target.
      isSuperAdmin: impersonatedBy ? false : effectiveUser.isSuperAdmin,
      tenantId: membership.tenant.id,
      tenantName: membership.tenant.name,
      tenantSlug: membership.tenant.slug,
      tenantPlan: membership.tenant.plan,
      roleId: membership.role?.id ?? '',
      roleName: membership.role?.name ?? '',
      permissions,
      supabaseId: authUser.id,
      mfaRequired: effectiveUser.mfaRequired,
    },
  };
});

/** Throwing variant for server components that require a user. */
export async function requireSession(): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}
