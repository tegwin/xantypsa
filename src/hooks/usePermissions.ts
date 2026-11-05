'use client';

// ============================================================
// Asking what this person may do
// ============================================================
// The API is the thing that actually enforces this. These helpers decide what
// to *show*: offering a button that answers Forbidden is a worse experience
// than not offering it, and it tells somebody about work they cannot do.

import { useSession } from '@/components/SessionProvider';
import type { Action, Module } from '@/lib/permissions';

export function usePermissions() {
  const { user } = useSession() as any;
  const permissions: string[] = user?.permissions || [];
  const isSuperAdmin: boolean = !!user?.isSuperAdmin;

  /** May they do this one thing? `manage` counts as all of them. */
  const can = (module: Module, action: Action): boolean =>
    isSuperAdmin ||
    permissions.includes(`${module}:${action}`) ||
    permissions.includes(`${module}:manage`);

  return { can, isSuperAdmin, permissions };
}
