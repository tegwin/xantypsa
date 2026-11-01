'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from '@/components/SessionProvider';
import { cn } from '@/lib/utils';
import { canAccessModule, type Module } from '@/lib/permissions';
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  LifeBuoy,
  FileText,
  Receipt,
  CreditCard,
  FolderKanban,
  Plug,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Zap,
  Webhook,
  Package,
  Clock,
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { signOut } from '@/components/SessionProvider';

interface NavChild {
  label: string;
  /** Omitted for a pure heading - a group that has no page of its own. */
  href?: string;
  /** A third level, for grouping related pages under one heading. */
  children?: { label: string; href: string }[];
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  module?: Module;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4.5 w-4.5" />,
    module: 'dashboard',
  },
  {
    label: 'CRM',
    icon: <Users className="h-4.5 w-4.5" />,
    module: 'crm',
    children: [
      // Contacts and prospects belong to a company, so they sit under it.
      {
        label: 'Companies',
        href: '/crm/companies',
        children: [
          { label: 'Contacts', href: '/crm/contacts' },
          { label: 'Prospects', href: '/crm/prospects' },
        ],
      },
      { label: 'Opportunities', href: '/crm/opportunities' },
    ],
  },
  {
    label: 'Service Desk',
    icon: <LifeBuoy className="h-4.5 w-4.5" />,
    module: 'service_desk',
    children: [
      { label: 'Tickets', href: '/service-desk/tickets' },
    ],
  },
  {
    label: 'Assets',
    href: '/assets/list',
    icon: <Monitor className="h-4.5 w-4.5" />,
    module: 'settings',
  },
  {
    label: 'Contracts',
    href: '/contracts/list',
    icon: <FileText className="h-4.5 w-4.5" />,
    module: 'contracts',
  },
  {
    label: 'Quotes',
    icon: <Receipt className="h-4.5 w-4.5" />,
    module: 'quotes',
    children: [
      { label: 'All Quotes', href: '/quotes/list' },
      { label: 'Pipeline', href: '/quotes/kanban' },
      { label: 'Dashboard', href: '/quotes/dashboard' },
      { label: 'New Quote', href: '/quotes/builder' },
    ],
  },
  {
    label: 'Products',
    href: '/products/list',
    icon: <Package className="h-4.5 w-4.5" />,
    module: 'settings',
  },
  {
    label: 'Billing',
    icon: <CreditCard className="h-4.5 w-4.5" />,
    module: 'invoices',
    children: [
      { label: 'Ready for Invoicing', href: '/billing/ready' },
      { label: 'Invoices', href: '/invoices/list' },
    ],
  },
  {
    label: 'Projects',
    href: '/projects/list',
    icon: <FolderKanban className="h-4.5 w-4.5" />,
    module: 'projects',
  },
  {
    label: 'Timesheets',
    href: '/timesheets',
    icon: <Clock className="h-4.5 w-4.5" />,
    module: 'time_tracking',
  },
  // Everything that connects Xanty PSA to something else. Its own section
  // rather than buried in Settings, because it is day-to-day work.
  {
    label: 'Integrations',
    href: '/integrations',
    icon: <Plug className="h-4.5 w-4.5" />,
    children: [
      { label: 'Webhooks', href: '/webhooks' },
      { label: 'API Keys', href: '/api-keys' },
      { label: 'API Docs', href: '/api-docs' },
      { label: 'Import Data', href: '/import' },
    ],
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: <BarChart3 className="h-4.5 w-4.5" />,
    module: 'reports',
    children: [
      { label: 'Profitability', href: '/reports/profitability' },
      { label: 'Sales Pipeline', href: '/reports/pipeline' },
    ],
  },
  {
    label: 'Settings',
    icon: <Settings className="h-4.5 w-4.5" />,
    module: 'settings',
    children: [
      // Grouped by subject so related pages sit together. A group with an href
      // is itself a page (Email, Integrations); one without is just a heading.
      { label: 'General', href: '/settings/general' },
      { label: 'AI', href: '/settings/ai' },
      {
        label: 'Email',
        href: '/settings/email',
        children: [
          { label: 'Processing', href: '/settings/email/processing' },
          { label: 'Templates', href: '/settings/email-templates' },
        ],
      },
      {
        label: 'Users & Access',
        children: [
          { label: 'Users', href: '/settings/users' },
          { label: 'Roles', href: '/settings/roles' },
        ],
      },
      { label: 'Service Desk', href: '/settings/service-desk' },
      { label: 'CRM', href: '/settings/crm' },
      { label: 'Products & Services', href: '/settings/products' },
      {
        label: 'Billing',
        children: [
          { label: 'Billing Rates', href: '/settings/billing' },
          { label: 'Quote Templates', href: '/settings/quote-templates' },
        ],
      },
      {
        label: 'Customisation',
        children: [
          { label: 'Custom Fields', href: '/settings/custom-fields' },
          { label: 'Entity Names', href: '/settings/entity-names' },
        ],
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  // Collapsed state for third-level groups, keyed "Parent/Child" so two groups
  // can share a label without fighting over one entry.
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const permissions = session?.user?.permissions ?? [];
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;

  const toggleExpand = (label: string) => {
    setExpanded((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // href is optional now that a group can be a heading with no page.
  const isActive = (href?: string) =>
    !!href && (pathname === href || pathname.startsWith(href + '/'));

  const filteredNav = NAV_ITEMS.filter(
    (item) => isSuperAdmin || !item.module || canAccessModule(permissions, item.module)
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-700/50">
        <Image src="/logo.svg" alt="Xanty PSA" width={32} height={32} className="rounded-lg" />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-surface-100 truncate">Xanty PSA</p>
            <p className="text-xs text-surface-500 truncate">{session?.user?.tenantName}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {filteredNav.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isExp = expanded.includes(item.label);
          // Also look a level deeper, so Settings stays highlighted on a page
          // that only exists inside one of its groups (e.g. /webhooks).
          const isItemActive = item.href
            ? isActive(item.href)
            : item.children?.some(
                (c) => isActive(c.href) || c.children?.some((g) => isActive(g.href))
              );

          return (
            <div key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                    isItemActive
                      ? 'bg-brand-600/15 text-brand-400 font-medium'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
                  )}
                >
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              ) : (
                <button
                  onClick={() => toggleExpand(item.label)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                    isItemActive
                      ? 'text-brand-400 font-medium'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
                  )}
                >
                  {item.icon}
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {hasChildren && (
                        <ChevronDown
                          className={cn('h-3.5 w-3.5 transition-transform', isExp && 'rotate-180')}
                        />
                      )}
                    </>
                  )}
                </button>
              )}

              {/* Sub-items */}
              {hasChildren && isExp && !collapsed && (
                <div className="ml-4 mt-0.5 pl-4 border-l border-surface-700/50 space-y-0.5">
                  {item.children!.map((child) => {
                    const groupKey = `${item.label}/${child.label}`;
                    const hasGroup = !!child.children?.length;
                    const groupHasActiveChild = !!child.children?.some((g) => isActive(g.href));
                    // Open when the user opened it, and always when they are on
                    // one of its pages - never hide the page you are looking at.
                    const groupOpen = expandedGroups.includes(groupKey) || groupHasActiveChild;

                    return (
                      <div key={child.label}>
                        <div className="flex items-center">
                          {child.href ? (
                            <Link
                              href={child.href}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                'flex-1 px-3 py-1.5 rounded-md text-sm transition-colors',
                                isActive(child.href)
                                  ? 'text-brand-400 bg-brand-600/10 font-medium'
                                  : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
                              )}
                            >
                              {child.label}
                            </Link>
                          ) : (
                            // A heading with no page of its own: the whole row
                            // toggles, since there is nowhere to navigate to.
                            <button
                              type="button"
                              onClick={() => toggleGroup(groupKey)}
                              aria-expanded={groupOpen}
                              className={cn(
                                'flex-1 px-3 py-1.5 text-left rounded-md text-xs font-semibold uppercase tracking-wide transition-colors',
                                groupHasActiveChild
                                  ? 'text-brand-400'
                                  : 'text-surface-500 hover:text-surface-300'
                              )}
                            >
                              {child.label}
                            </button>
                          )}

                          {hasGroup && (
                            // Separate from the link so the label still
                            // navigates and only the chevron collapses.
                            <button
                              type="button"
                              onClick={() => toggleGroup(groupKey)}
                              aria-expanded={groupOpen}
                              aria-label={`${groupOpen ? 'Collapse' : 'Expand'} ${child.label}`}
                              className="p-1 rounded text-surface-500 hover:text-surface-200 hover:bg-surface-800"
                            >
                              <ChevronDown
                                className={cn(
                                  'h-3 w-3 transition-transform',
                                  groupOpen && 'rotate-180'
                                )}
                              />
                            </button>
                          )}
                        </div>

                        {hasGroup && groupOpen && (
                          <div className="ml-3 pl-3 border-l border-surface-700/40 space-y-0.5">
                            {child.children!.map((grandchild) => (
                              <Link
                                key={grandchild.href}
                                href={grandchild.href}
                                onClick={() => setMobileOpen(false)}
                                className={cn(
                                  'block px-3 py-1.5 rounded-md text-[13px] transition-colors',
                                  isActive(grandchild.href)
                                    ? 'text-brand-400 bg-brand-600/10 font-medium'
                                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50'
                                )}
                              >
                                {grandchild.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-surface-700/50 p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand-600/20 flex items-center justify-center text-sm font-medium text-brand-400">
            {session?.user?.name?.charAt(0) || '?'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-200 truncate">{session?.user?.name}</p>
              <p className="text-xs text-surface-500 truncate">{session?.user?.roleName}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-surface-500 hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-surface-800 border border-surface-700 text-surface-300"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-surface-900 border-r border-surface-700/50 z-50">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-surface-400 hover:text-surface-200"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col bg-surface-900 border-r border-surface-700/50 transition-all duration-200',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
