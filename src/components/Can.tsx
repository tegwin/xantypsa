'use client';

// Show the children only when this person may do that thing. Nothing is
// rendered otherwise, not a disabled control: a greyed-out button still
// advertises a feature somebody cannot use.

import { usePermissions } from '@/hooks/usePermissions';
import type { Action, Module } from '@/lib/permissions';

export default function Can({
  module,
  action,
  children,
}: {
  module: Module;
  action: Action;
  children: React.ReactNode;
}) {
  const { can } = usePermissions();
  if (!can(module, action)) return null;
  return <>{children}</>;
}
