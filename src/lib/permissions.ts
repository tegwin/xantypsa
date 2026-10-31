// ============================================================
// XantyPSA - Role-Based Access Control System
// ============================================================

export const MODULES = [
  'dashboard',
  'crm',
  'service_desk',
  'contracts',
  'quotes',
  'invoices',
  'projects',
  'time_tracking',
  'reports',
  'settings',
  'integrations',
  'webhooks',
] as const;

export type Module = (typeof MODULES)[number];

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'manage'] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Module}:${Action}`;

// Build all possible permissions
export const ALL_PERMISSIONS: Permission[] = MODULES.flatMap((mod) =>
  ACTIONS.map((action) => `${mod}:${action}` as Permission)
);

// ============================================================
// Default Role Templates
// ============================================================

export const ROLE_TEMPLATES = {
  admin: {
    name: 'Administrator',
    slug: 'admin',
    description: 'Full access to all modules and settings',
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  },
  manager: {
    name: 'Manager',
    slug: 'manager',
    description: 'Access to most modules, limited settings',
    permissions: ALL_PERMISSIONS.filter(
      (p) => !p.startsWith('settings:manage') && !p.startsWith('webhooks:manage') && !p.startsWith('integrations:manage')
    ),
    isSystem: true,
  },
  technician: {
    name: 'Technician',
    slug: 'technician',
    description: 'Service desk, time entries, and project tasks',
    permissions: [
      'dashboard:view',
      'crm:view',
      'service_desk:view', 'service_desk:create', 'service_desk:edit',
      'contracts:view',
      'projects:view', 'projects:edit',
      'time_tracking:view', 'time_tracking:create', 'time_tracking:edit',
      'reports:view',
    ] as Permission[],
    isSystem: true,
  },
  sales: {
    name: 'Sales',
    slug: 'sales',
    description: 'CRM, quotes, and deals management',
    permissions: [
      'dashboard:view',
      'crm:view', 'crm:create', 'crm:edit', 'crm:delete',
      'quotes:view', 'quotes:create', 'quotes:edit', 'quotes:delete', 'quotes:export',
      'invoices:view',
      'contracts:view', 'contracts:create',
      'reports:view',
    ] as Permission[],
    isSystem: true,
  },
  finance: {
    name: 'Finance',
    slug: 'finance',
    description: 'Invoicing, payments, and financial reports',
    permissions: [
      'dashboard:view',
      'crm:view',
      'contracts:view', 'contracts:edit',
      'quotes:view',
      'invoices:view', 'invoices:create', 'invoices:edit', 'invoices:delete', 'invoices:export',
      'reports:view', 'reports:create', 'reports:export',
    ] as Permission[],
    isSystem: true,
  },
  viewer: {
    name: 'Viewer',
    slug: 'viewer',
    description: 'Read-only access to most modules',
    permissions: MODULES.filter((m) => m !== 'settings' && m !== 'webhooks' && m !== 'integrations').map(
      (m) => `${m}:view` as Permission
    ),
    isSystem: true,
  },
} as const;

// ============================================================
// Permission Checking Utilities
// ============================================================

export function hasPermission(userPermissions: string[], required: Permission): boolean {
  return userPermissions.includes(required);
}

export function hasAnyPermission(userPermissions: string[], required: Permission[]): boolean {
  return required.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(userPermissions: string[], required: Permission[]): boolean {
  return required.every((p) => userPermissions.includes(p));
}

export function canAccessModule(userPermissions: string[], module: Module): boolean {
  return userPermissions.some((p) => p.startsWith(`${module}:`));
}

// Group permissions by module for UI display
export function groupPermissionsByModule(permissions: Permission[]): Record<Module, Action[]> {
  const grouped = {} as Record<Module, Action[]>;
  for (const perm of permissions) {
    const [mod, action] = perm.split(':') as [Module, Action];
    if (!grouped[mod]) grouped[mod] = [];
    grouped[mod].push(action);
  }
  return grouped;
}

// Module display names
export const MODULE_LABELS: Record<Module, string> = {
  dashboard: 'Dashboard',
  crm: 'CRM',
  service_desk: 'Service Desk',
  contracts: 'Contracts',
  quotes: 'Quotes',
  invoices: 'Invoicing',
  projects: 'Projects',
  time_tracking: 'Time Tracking',
  reports: 'Reports',
  settings: 'Settings',
  integrations: 'Integrations',
  webhooks: 'Webhooks',
};

export const ACTION_LABELS: Record<Action, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  export: 'Export',
  manage: 'Manage',
};
