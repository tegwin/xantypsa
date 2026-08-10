// ============================================================
// URL -> module context
// ============================================================
// The assistant is mounted once in the dashboard layout and works out which
// part of the product it is sitting in from the path. Adding a screen needs no
// change here unless you want a bespoke label; unmatched paths still get a
// working assistant, just without the extra steer.

export interface ModuleContext {
  /** Passed to the model as "the user is on the X screen". */
  module: string;
  label: string;
  /** Seeded into the panel as clickable starters. */
  suggestions: string[];
}

const MODULES: { match: RegExp; ctx: ModuleContext }[] = [
  {
    match: /^\/(service-desk|tickets)/,
    ctx: {
      module: 'tickets',
      label: 'Tickets',
      suggestions: [
        'How many tickets are open right now, by status?',
        'Which tickets have been untouched for more than 7 days?',
        'Show tickets opened and closed on the same day in the last 6 months',
      ],
    },
  },
  {
    match: /^\/crm\/opportunities/,
    ctx: {
      module: 'opportunities',
      label: 'Opportunities',
      suggestions: [
        'What is the total value of open opportunities by stage?',
        'Which opportunities are expected to close this month?',
        'Create an opportunity for Acme worth 12000 at proposal stage',
      ],
    },
  },
  {
    match: /^\/contracts/,
    ctx: {
      module: 'contracts',
      label: 'Contracts',
      suggestions: [
        'Which contracts expire in the next 90 days?',
        'What is our total contract value by type?',
        'Which active contracts have no invoices raised against them?',
      ],
    },
  },
  {
    match: /^\/(invoices|billing)/,
    ctx: {
      module: 'invoices',
      label: 'Billing',
      suggestions: [
        'What is currently outstanding, by company?',
        'Which invoices are overdue and by how many days?',
        'Show recurring invoices due to bill this month',
      ],
    },
  },
  {
    match: /^\/quotes/,
    ctx: {
      module: 'quotes',
      label: 'Quotes',
      suggestions: [
        'What is the total value of quotes awaiting acceptance?',
        'Which quotes have expired without being accepted?',
      ],
    },
  },
  {
    match: /^\/reports/,
    ctx: {
      module: 'reports',
      label: 'Reports',
      suggestions: [
        'Show all tickets from the last 6 months opened and closed the same day',
        'Break down billable vs non-billable hours by engineer this month',
        'Which customers generated the most ticket volume this quarter?',
      ],
    },
  },
  {
    match: /^\/crm\/companies/,
    ctx: {
      module: 'companies',
      label: 'Companies',
      suggestions: [
        'Which customers have no tickets in the last 90 days?',
        'Show companies by number of open tickets',
      ],
    },
  },
  {
    match: /^\/crm/,
    ctx: {
      module: 'crm',
      label: 'CRM',
      suggestions: ['Which contacts have no recent activity?'],
    },
  },
  {
    match: /^\/projects/,
    ctx: {
      module: 'projects',
      label: 'Projects',
      suggestions: [
        'Which projects are over their budgeted hours?',
        'Show projects with tasks overdue',
      ],
    },
  },
  {
    match: /^\/time/,
    ctx: {
      module: 'time tracking',
      label: 'Time',
      suggestions: [
        'How many unbilled billable hours are outstanding?',
        'Show hours logged per engineer this week',
      ],
    },
  },
];

const FALLBACK: ModuleContext = {
  module: 'dashboard',
  label: 'VibePSA',
  suggestions: [
    'How many tickets are open?',
    'What is outstanding on invoices right now?',
    'Which contracts expire in the next 90 days?',
  ],
};

export function moduleForPath(pathname: string): ModuleContext {
  return MODULES.find((m) => m.match.test(pathname))?.ctx ?? FALLBACK;
}

/** A trailing cuid in the path means the user is looking at one record. */
export function recordIdForPath(pathname: string): string | undefined {
  const last = pathname.split('/').filter(Boolean).pop();
  return last && /^c[a-z0-9]{20,}$/i.test(last) ? last : undefined;
}
