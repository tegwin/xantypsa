// ============================================================
// Application session
// ============================================================
// VibePSA authenticates its own users — see lib/auth/local. The signed session
// cookie says *who you are*; the database says which tenant, role and
// permissions you have, and is re-read on every request.
//
// The returned shape has been stable across NextAuth and Supabase Auth, so
// every API route and page keeps working — the swap stays confined to this
// file.

import { cache } from 'react';
import { prisma } from './prisma';
import { readSessionCookie } from './auth/local';
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
 * `cache()` dedupes this per request, so a page and the API calls it triggers
 * don't each re-query Postgres.
 */
export const getAppSession = cache(async (): Promise<AppSession | null> => {
  // The cookie is signed, so its user id is trustworthy — but only as an
  // identifier. Everything that governs access is read fresh below, so
  // deactivating someone takes effect on their next request.
  const payload = readSessionCookie();
  if (!payload) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.userId, isActive: true },
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

  // Enrolled in two-factor but this session has not passed the challenge:
  // treat it as not signed in rather than let it through half-authenticated.
  if (user.totpSecret && !payload.mfa) return null;

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
