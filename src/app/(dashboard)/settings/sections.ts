// ============================================================
// The administration menu
// ============================================================
// One definition, used by the settings sub-navigation and the landing page, so
// a new settings screen appears in both the moment it is added here.

export interface SettingsLink {
  label: string;
  href: string;
  /** One line, shown on the landing page card. */
  description: string;
}

export interface SettingsSection {
  title: string;
  links: SettingsLink[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: 'General',
    links: [
      { label: 'Organisation', href: '/settings/general', description: 'Your name, address, currency and tax rate.' },
      { label: 'Entity Names', href: '/settings/entity-names', description: 'Call things what your business calls them.' },
      { label: 'Custom Fields', href: '/settings/custom-fields', description: 'Extra fields on companies, contacts and tickets.' },
    ],
  },
  {
    title: 'Accounts',
    links: [
      { label: 'Users', href: '/settings/users', description: 'The people who work in the system, and their burden rates.' },
      { label: 'Roles', href: '/settings/roles', description: 'What each person is allowed to do.' },
    ],
  },
  {
    title: 'Service delivery',
    links: [
      { label: 'Service Desk', href: '/settings/service-desk', description: 'Statuses, queues, the timer and ticket references.' },
      { label: 'CRM', href: '/settings/crm', description: 'Pipeline stages, win and loss reasons, required fields.' },
      { label: 'Client Portal', href: '/settings/client-portal', description: 'What your customers can see when they sign in.' },
    ],
  },
  {
    title: 'Money',
    links: [
      { label: 'Billing Rates', href: '/settings/billing', description: 'Hourly rates, minimums, rounding and non-billable.' },
      { label: 'Products & Services', href: '/settings/products', description: 'What you sell, and what it costs you.' },
      { label: 'Quote Templates', href: '/settings/quote-templates', description: 'Reusable quotes for the things you sell often.' },
      { label: 'Payment Webhooks', href: '/settings/payment-webhooks', description: 'Let a payment provider mark invoices paid automatically.' },
    ],
  },
  {
    title: 'Email',
    links: [
      { label: 'Email', href: '/settings/email', description: 'Sending and receiving, and the mailbox tickets come from.' },
      { label: 'Processing', href: '/settings/email/processing', description: 'How incoming mail becomes tickets.' },
      { label: 'Templates', href: '/settings/email-templates', description: 'What the system sends on your behalf.' },
    ],
  },
  {
    title: 'Automation',
    links: [
      { label: 'AI', href: '/settings/ai', description: 'The assistant, and the restricted role it reads with.' },
    ],
  },
];

/** Flat list, for finding the current page. */
export const ALL_SETTINGS_LINKS = SETTINGS_SECTIONS.flatMap((s) => s.links);
