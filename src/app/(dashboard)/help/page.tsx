'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import { Book, Code, Zap, FileText, Users, Ticket, FileCheck, DollarSign, Clock, Briefcase, BarChart3, Settings, ChevronDown, ChevronRight, Copy, Check, BookOpen } from 'lucide-react';
import Link from 'next/link';

// === API ENDPOINT DEFINITIONS ===
interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  params?: { name: string; type: string; required?: boolean; description: string }[];
  queryParams?: { name: string; type: string; description: string }[];
  body?: { name: string; type: string; required?: boolean; description: string }[];
  response?: string;
}

interface ApiSection {
  title: string;
  icon: any;
  description: string;
  basePath: string;
  endpoints: Endpoint[];
}

const API_DOCS: ApiSection[] = [
  {
    title: 'Companies', icon: Users, description: 'Manage client companies', basePath: '/api/companies',
    endpoints: [
      { method: 'GET', path: '/api/companies', description: 'List all companies with pagination, search, and filtering',
        queryParams: [
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Results per page (default: 25)' },
          { name: 'search', type: 'string', description: 'Search by name or domain' },
          { name: 'sortBy', type: 'string', description: 'Sort field (default: createdAt)' },
          { name: 'sortDir', type: 'asc|desc', description: 'Sort direction (default: desc)' },
        ],
        response: '{ items: Company[], total, page, limit, pages }',
      },
      { method: 'POST', path: '/api/companies', description: 'Create a new company',
        body: [
          { name: 'name', type: 'string', required: true, description: 'Company name' },
          { name: 'domain', type: 'string', description: 'Website domain' },
          { name: 'phone', type: 'string', description: 'Phone number' },
          { name: 'email', type: 'string', description: 'Main email' },
          { name: 'industry', type: 'string', description: 'Industry sector' },
          { name: 'address', type: 'string', description: 'Street address' },
          { name: 'city', type: 'string', description: 'City' },
          { name: 'postcode', type: 'string', description: 'Postal code' },
          { name: 'country', type: 'string', description: 'Country code' },
          { name: 'notes', type: 'string', description: 'Internal notes' },
        ],
      },
      { method: 'GET', path: '/api/companies/{id}', description: 'Get company detail with contacts, tickets, contracts, and invoices' },
      { method: 'PATCH', path: '/api/companies/{id}', description: 'Update a company', body: [{ name: '...fields', type: 'any', description: 'Any company field to update' }] },
      { method: 'DELETE', path: '/api/companies/{id}', description: 'Delete a company (soft-delete: sets isActive=false)' },
    ],
  },
  {
    title: 'Contacts', icon: Users, description: 'Manage contacts with many-to-many company relationships', basePath: '/api/contacts',
    endpoints: [
      { method: 'GET', path: '/api/contacts', description: 'List contacts with search and company filter',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by name or email' },
          { name: 'companyId', type: 'string', description: 'Filter by company' },
        ],
      },
      { method: 'POST', path: '/api/contacts', description: 'Create a contact',
        body: [
          { name: 'firstName', type: 'string', required: true, description: 'First name' },
          { name: 'lastName', type: 'string', required: true, description: 'Last name' },
          { name: 'email', type: 'string', description: 'Email address' },
          { name: 'phone', type: 'string', description: 'Phone number' },
          { name: 'companyId', type: 'string', description: 'Primary company ID' },
          { name: 'jobTitle', type: 'string', description: 'Job title' },
        ],
      },
      { method: 'GET', path: '/api/contacts/{id}', description: 'Get contact detail with linked companies' },
      { method: 'PATCH', path: '/api/contacts/{id}', description: 'Update a contact' },
      { method: 'DELETE', path: '/api/contacts/{id}', description: 'Delete a contact' },
    ],
  },
  {
    title: 'Tickets', icon: Ticket, description: 'Service desk ticket management with custom statuses and queues', basePath: '/api/tickets',
    endpoints: [
      { method: 'GET', path: '/api/tickets', description: 'List tickets with filtering by status, queue, priority, and company',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by title or ticket number' },
          { name: 'status', type: 'string', description: 'Filter by status slug' },
          { name: 'priority', type: 'string', description: 'Filter by priority (low, medium, high, critical)' },
          { name: 'queueId', type: 'string', description: 'Filter by queue' },
          { name: 'companyId', type: 'string', description: 'Filter by company' },
          { name: 'assignedToId', type: 'string', description: 'Filter by assigned agent' },
        ],
      },
      { method: 'POST', path: '/api/tickets', description: 'Create a new ticket',
        body: [
          { name: 'title', type: 'string', required: true, description: 'Ticket subject' },
          { name: 'description', type: 'string', description: 'Detailed description' },
          { name: 'companyId', type: 'string', description: 'Company this ticket is for' },
          { name: 'contactId', type: 'string', description: 'Contact who raised the ticket' },
          { name: 'priority', type: 'string', description: 'low, medium, high, critical' },
          { name: 'type', type: 'string', description: 'incident, request, problem, change' },
          { name: 'queueId', type: 'string', description: 'Queue to assign to' },
          { name: 'assignedToId', type: 'string', description: 'Agent to assign' },
          { name: 'contractId', type: 'string', description: 'Contract to bill against' },
        ],
      },
      { method: 'GET', path: '/api/tickets/{id}', description: 'Get full ticket detail with notes, time entries, company, contact, and contract' },
      { method: 'PATCH', path: '/api/tickets/{id}', description: 'Update ticket fields' },
      { method: 'DELETE', path: '/api/tickets/{id}', description: 'Delete a ticket and all related records' },
      { method: 'POST', path: '/api/tickets/{id}/notes', description: 'Add a note, log time, and/or change status in a single action',
        body: [
          { name: 'content', type: 'string', description: 'Note text' },
          { name: 'isInternal', type: 'boolean', description: 'Internal-only note (default: false)' },
          { name: 'timeMinutes', type: 'number', description: 'Time to log in minutes' },
          { name: 'billingRateId', type: 'string', description: 'Billing rate for time entry' },
          { name: 'isOOH', type: 'boolean', description: 'Out-of-hours time (applies OOH multiplier)' },
          { name: 'billable', type: 'boolean', description: 'Whether time is billable (default: true)' },
          { name: 'newStatus', type: 'string', description: 'Status slug to transition to' },
        ],
        response: '{ note, timeEntry, statusChanged }',
      },
    ],
  },
  {
    title: 'Contracts', icon: FileCheck, description: 'Service contracts with 4 types: T&M, Fixed Price, Pre-Pay Hours, Monthly Service', basePath: '/api/contracts',
    endpoints: [
      { method: 'GET', path: '/api/contracts', description: 'List contracts with company, exclusions, and ticket counts',
        queryParams: [
          { name: 'status', type: 'string', description: 'Filter: draft, active, suspended, expired, cancelled' },
          { name: 'type', type: 'string', description: 'Filter: time_and_materials, fixed_price, prepay_hours, managed_service' },
          { name: 'companyId', type: 'string', description: 'Filter by company' },
        ],
      },
      { method: 'POST', path: '/api/contracts', description: 'Create a contract',
        body: [
          { name: 'name', type: 'string', required: true, description: 'Contract name' },
          { name: 'companyId', type: 'string', required: true, description: 'Company ID' },
          { name: 'type', type: 'string', required: true, description: 'time_and_materials | fixed_price | prepay_hours | managed_service' },
          { name: 'startDate', type: 'ISO date', description: 'Contract start' },
          { name: 'endDate', type: 'ISO date', description: 'Contract end (null for no end)' },
          { name: 'fixedPrice', type: 'number', description: '[fixed_price] Total contract value' },
          { name: 'billingMode', type: 'string', description: '[fixed_price] one_off or instalment' },
          { name: 'instalmentCount', type: 'number', description: '[fixed_price] Number of instalments' },
          { name: 'totalHours', type: 'number', description: '[prepay_hours] Hours in block' },
          { name: 'overhourRate', type: 'number', description: '[prepay_hours] Rate per hour when block exceeded' },
          { name: 'monthlyFee', type: 'number', description: '[managed_service] Monthly recurring fee' },
          { name: 'excludedRateIds', type: 'string[]', description: '[prepay/managed] Billing rate IDs excluded from contract' },
          { name: 'billingCycle', type: 'string', description: 'monthly, quarterly, annually' },
        ],
      },
      { method: 'GET', path: '/api/contracts/{id}', description: 'Get contract detail with exclusions, instalments, and linked tickets' },
      { method: 'PATCH', path: '/api/contracts/{id}', description: 'Update contract. Pass excludedRateIds to replace all exclusions.' },
      { method: 'DELETE', path: '/api/contracts/{id}', description: 'Delete a contract' },
    ],
  },
  {
    title: 'Invoices', icon: DollarSign, description: 'Invoice management with PDF generation and payment tracking', basePath: '/api/invoices',
    endpoints: [
      { method: 'GET', path: '/api/invoices', description: 'List invoices with status and company filtering',
        queryParams: [
          { name: 'status', type: 'string', description: 'draft, sent, paid, overdue, cancelled' },
          { name: 'companyId', type: 'string', description: 'Filter by company' },
        ],
      },
      { method: 'POST', path: '/api/invoices', description: 'Create invoice with line items',
        body: [
          { name: 'companyId', type: 'string', required: true, description: 'Company to invoice' },
          { name: 'lineItems', type: 'array', required: true, description: '[{ description, quantity, unitPrice, taxRate }]' },
          { name: 'dueDate', type: 'ISO date', description: 'Payment due date (default: +30 days)' },
          { name: 'notes', type: 'string', description: 'Invoice notes' },
          { name: 'terms', type: 'string', description: 'Payment terms text' },
          { name: 'contactId', type: 'string', description: 'Contact for the invoice' },
        ],
      },
      { method: 'GET', path: '/api/invoices/{id}', description: 'Get invoice detail with line items, payments, and company' },
      { method: 'PATCH', path: '/api/invoices/{id}', description: 'Update invoice (status changes trigger sentAt/paidAt timestamps)' },
      { method: 'DELETE', path: '/api/invoices/{id}', description: 'Delete invoice and related payments' },
      { method: 'POST', path: '/api/invoices/{id}/payments', description: 'Record a payment against an invoice',
        body: [
          { name: 'amount', type: 'number', required: true, description: 'Payment amount' },
          { name: 'paymentDate', type: 'ISO date', description: 'Date of payment' },
          { name: 'method', type: 'string', description: 'bank_transfer, credit_card, cash, cheque, direct_debit, other' },
          { name: 'reference', type: 'string', description: 'Transaction reference' },
        ],
      },
    ],
  },
  {
    title: 'Billing', icon: DollarSign, description: 'Ready-for-invoicing view and batch invoice creation', basePath: '/api/billing',
    endpoints: [
      { method: 'GET', path: '/api/billing/ready', description: 'Get unbilled time entries grouped by company. Respects billing mode (anytime vs on-close).',
        response: 'TimeEntry[] (billable: true, billed: false, with ticket and billingRate includes)',
      },
      { method: 'POST', path: '/api/billing/create-invoice', description: 'Create invoice from selected time entries. Groups by billing rate.',
        body: [
          { name: 'entryIds', type: 'string[]', required: true, description: 'Array of time entry IDs to invoice' },
          { name: 'companyId', type: 'string', description: 'Company ID (auto-detected from entries)' },
          { name: 'title', type: 'string', description: 'Invoice title' },
          { name: 'dueInDays', type: 'number', description: 'Days until due (default: 30)' },
        ],
      },
    ],
  },
  {
    title: 'Quotes', icon: FileText, description: 'Quote management with PDF generation and invoice conversion', basePath: '/api/quotes',
    endpoints: [
      { method: 'GET', path: '/api/quotes', description: 'List quotes with status filtering' },
      { method: 'POST', path: '/api/quotes', description: 'Create a quote',
        body: [
          { name: 'companyId', type: 'string', required: true, description: 'Company ID' },
          { name: 'title', type: 'string', description: 'Quote title' },
          { name: 'lineItems', type: 'array', description: '[{ description, quantity, unitPrice, taxRate }]' },
          { name: 'validUntil', type: 'ISO date', description: 'Quote validity date' },
        ],
      },
      { method: 'GET', path: '/api/quotes/{id}', description: 'Get quote detail with line items' },
      { method: 'PATCH', path: '/api/quotes/{id}', description: 'Update quote' },
      { method: 'DELETE', path: '/api/quotes/{id}', description: 'Delete quote' },
    ],
  },
  {
    title: 'Time Entries', icon: Clock, description: 'Time tracking with billing rate integration and contract awareness', basePath: '/api/time-entries',
    endpoints: [
      { method: 'GET', path: '/api/time-entries', description: 'List time entries with date range, user, ticket, and project filtering',
        queryParams: [
          { name: 'userId', type: 'string', description: 'Filter by user' },
          { name: 'ticketId', type: 'string', description: 'Filter by ticket' },
          { name: 'projectId', type: 'string', description: 'Filter by project' },
          { name: 'dateFrom', type: 'YYYY-MM-DD', description: 'Start date' },
          { name: 'dateTo', type: 'YYYY-MM-DD', description: 'End date' },
        ],
        response: '{ items, total, pages, totalHours }',
      },
      { method: 'POST', path: '/api/time-entries', description: 'Create a standalone time entry',
        body: [
          { name: 'hours', type: 'number', required: true, description: 'Hours worked' },
          { name: 'ticketId', type: 'string', description: 'Link to ticket' },
          { name: 'projectId', type: 'string', description: 'Link to project' },
          { name: 'description', type: 'string', description: 'Work description' },
          { name: 'date', type: 'ISO date', description: 'Entry date' },
          { name: 'billable', type: 'boolean', description: 'Billable (default: true)' },
          { name: 'rate', type: 'number', description: 'Hourly rate override' },
        ],
      },
    ],
  },
  {
    title: 'Projects', icon: Briefcase, description: 'Project management with tasks and milestones', basePath: '/api/projects',
    endpoints: [
      { method: 'GET', path: '/api/projects', description: 'List projects' },
      { method: 'POST', path: '/api/projects', description: 'Create project',
        body: [
          { name: 'name', type: 'string', required: true, description: 'Project name' },
          { name: 'companyId', type: 'string', description: 'Client company' },
          { name: 'budget', type: 'number', description: 'Project budget' },
          { name: 'startDate', type: 'ISO date', description: 'Start date' },
          { name: 'endDate', type: 'ISO date', description: 'End date' },
        ],
      },
      { method: 'GET', path: '/api/projects/{id}', description: 'Get project with tasks, milestones, and team' },
      { method: 'PATCH', path: '/api/projects/{id}', description: 'Update project' },
      { method: 'DELETE', path: '/api/projects/{id}', description: 'Delete project' },
    ],
  },
  {
    title: 'Opportunities', icon: Zap, description: 'Sales pipeline and deal tracking', basePath: '/api/opportunities',
    endpoints: [
      { method: 'GET', path: '/api/opportunities', description: 'List opportunities with stage and pipeline filtering' },
      { method: 'POST', path: '/api/opportunities', description: 'Create opportunity',
        body: [
          { name: 'title', type: 'string', required: true, description: 'Deal title' },
          { name: 'companyId', type: 'string', description: 'Company' },
          { name: 'value', type: 'number', description: 'Deal value' },
          { name: 'stage', type: 'string', description: 'Pipeline stage' },
          { name: 'probability', type: 'number', description: 'Close probability (0-100)' },
        ],
      },
      { method: 'GET', path: '/api/opportunities/{id}', description: 'Get opportunity detail' },
      { method: 'PATCH', path: '/api/opportunities/{id}', description: 'Update opportunity' },
      { method: 'DELETE', path: '/api/opportunities/{id}', description: 'Delete opportunity' },
    ],
  },
  {
    title: 'Billing Rates', icon: Settings, description: 'Configure billing rates with minimums, rounding, and OOH multipliers', basePath: '/api/billing-rates',
    endpoints: [
      { method: 'GET', path: '/api/billing-rates', description: 'List all billing rates', response: '{ items: BillingRate[] }' },
      { method: 'POST', path: '/api/billing-rates', description: 'Create billing rate',
        body: [
          { name: 'name', type: 'string', required: true, description: 'Rate name (e.g. "Standard")' },
          { name: 'code', type: 'string', description: 'Short code (e.g. "STD")' },
          { name: 'rate', type: 'number', required: true, description: 'Hourly rate in GBP' },
          { name: 'minimumMinutes', type: 'number', description: 'Minimum billable time (default: 15)' },
          { name: 'roundingMinutes', type: 'number', description: 'Round-up increment (default: 15)' },
          { name: 'oohMultiplier', type: 'number', description: 'Out-of-hours multiplier (default: 1.0)' },
          { name: 'isDefault', type: 'boolean', description: 'Set as default rate' },
        ],
      },
      { method: 'PATCH', path: '/api/billing-rates/{id}', description: 'Update billing rate' },
      { method: 'DELETE', path: '/api/billing-rates/{id}', description: 'Delete billing rate' },
    ],
  },
  {
    title: 'Ticket Statuses', icon: Settings, description: 'Custom ticket statuses with colours and closed flags', basePath: '/api/ticket-statuses',
    endpoints: [
      { method: 'GET', path: '/api/ticket-statuses', description: 'List all custom ticket statuses', response: '{ items: TicketStatus[] }' },
      { method: 'POST', path: '/api/ticket-statuses', description: 'Create status',
        body: [
          { name: 'name', type: 'string', required: true, description: 'Display name' },
          { name: 'color', type: 'string', description: 'Hex colour code' },
          { name: 'isClosed', type: 'boolean', description: 'Treat as closed status' },
          { name: 'isDefault', type: 'boolean', description: 'Set as default for new tickets' },
        ],
      },
      { method: 'PATCH', path: '/api/ticket-statuses/{id}', description: 'Update status' },
      { method: 'DELETE', path: '/api/ticket-statuses/{id}', description: 'Delete status (cannot delete system statuses)' },
    ],
  },
  {
    title: 'Ticket Queues', icon: Settings, description: 'Queue management for ticket routing', basePath: '/api/ticket-queues',
    endpoints: [
      { method: 'GET', path: '/api/ticket-queues', description: 'List all queues' },
      { method: 'POST', path: '/api/ticket-queues', description: 'Create queue',
        body: [{ name: 'name', type: 'string', required: true, description: 'Queue name' }],
      },
      { method: 'PATCH', path: '/api/ticket-queues/{id}', description: 'Update queue' },
      { method: 'DELETE', path: '/api/ticket-queues/{id}', description: 'Delete queue' },
    ],
  },
  {
    title: 'Reports', icon: BarChart3, description: 'Dashboard and reporting endpoints', basePath: '/api/reports',
    endpoints: [
      { method: 'GET', path: '/api/reports/dashboard', description: 'Get dashboard statistics including ticket counts, revenue, and time tracking totals' },
    ],
  },
  {
    title: 'Settings', icon: Settings, description: 'Tenant settings including service desk billing mode', basePath: '/api/settings',
    endpoints: [
      { method: 'GET', path: '/api/settings/service-desk', description: 'Get service desk settings (billing mode)' },
      { method: 'PATCH', path: '/api/settings/service-desk', description: 'Update service desk settings',
        body: [{ name: 'serviceDeskBillingMode', type: 'string', description: '"anytime" or "on_close"' }],
      },
    ],
  },
];

// === Product Guide Sections ===
const GUIDE_SECTIONS = [
  { title: 'Getting Started', content: `## Quick Start\n\n1. **Create a Company** — Go to CRM → Companies and add your first client\n2. **Set Up Billing Rates** — Go to Settings → Billing Rates and configure your hourly rates\n3. **Create a Ticket** — Go to Service Desk → Tickets, select the company, and log your first ticket\n4. **Log Time** — On a ticket, use the time entry panel to log time with a billing rate\n5. **Generate an Invoice** — Go to Billing → Ready for Invoicing to batch-create invoices from time entries` },
  { title: 'Contract Types', content: `## Contract Types\n\n**Time & Materials (T&M)** — No contract needed. Every time entry is billed at the selected billing rate. Entries appear in Ready for Invoicing grouped by company.\n\n**Fixed Price** — A fixed amount contract that can be billed in one lump sum or split into instalments. Assign to tickets and projects. Time is tracked but not billed per-entry; the contract value is the invoice.\n\n**Pre-Pay Hours** — The client pre-purchases a block of hours. When time is logged on tickets linked to this contract, hours are automatically deducted from the block. You can exclude specific billing rates (e.g. "Onsite") so they're charged as T&M instead.\n\n**Monthly Service** — A recurring monthly fee covers all labour. Time is tracked but not billed per-entry. Like Pre-Pay, you can exclude billing rates so certain work is still charged as T&M.` },
  { title: 'Billing Workflow', content: `## Billing Workflow\n\n1. **Configure Billing Rates** — Set up rates with minimums (e.g. 15 min), rounding (e.g. 15 min increments), and OOH multipliers\n2. **Log Time on Tickets** — Each entry calculates billed minutes, rate, and amount automatically\n3. **Ready for Invoicing** — Unbilled entries grouped by company. Select entries and click "Create Invoice"\n4. **Invoice Management** — Track draft → sent → paid lifecycle. Record payments. Download PDFs.\n5. **Billing Mode** — Choose "Bill Anytime" or "Bill on Close Only" in Settings → Service Desk` },
  { title: 'Rate Exclusions', content: `## Rate Exclusions on Contracts\n\nWhen creating a Pre-Pay Hours or Monthly Service contract, you can exclude specific billing rates.\n\n**How it works:**\n- When time is logged on a ticket linked to the contract\n- The system checks the billing rate against the contract's exclusion list\n- If the rate IS excluded → time is charged as T&M (appears in Ready for Invoicing)\n- If the rate is NOT excluded → time is covered by the contract (deducted from block or included in monthly fee)\n\n**Example:** A "Monthly Support" contract excludes the "Onsite" billing rate. Remote support is covered. Onsite visits are billed separately at the Onsite hourly rate.` },
  { title: 'Multi-Tenancy', content: `## Multi-Tenancy\n\nXanty PSA supports full multi-tenancy with complete data isolation:\n\n- Every record is scoped to a tenantId\n- Users belong to tenants via TenantUser junction table\n- 6 default roles: Admin, Manager, Engineer, Account Manager, Finance, Read Only\n- Module-level permissions: CRM, Service Desk, Projects, Billing, Reports, Settings\n- Each tenant has independent billing rates, statuses, queues, and settings` },
];

// === Components ===
function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-green-500/15 text-green-400 border-green-500/30',
    POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${colors[method] || ''}`}>{method}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-surface-700 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-surface-500" />}
    </button>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = endpoint.body?.length || endpoint.queryParams?.length || endpoint.response;

  return (
    <div className="border border-surface-700/50 rounded-lg overflow-hidden">
      <div className={`flex items-center gap-3 px-4 py-3 ${hasDetails ? 'cursor-pointer hover:bg-surface-800/50' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}>
        <MethodBadge method={endpoint.method} />
        <code className="text-sm text-surface-200 font-mono flex-1">{endpoint.path}</code>
        <CopyButton text={endpoint.path} />
        <span className="text-xs text-surface-500 max-w-[300px] truncate hidden md:block">{endpoint.description}</span>
        {hasDetails && (expanded ? <ChevronDown className="w-4 h-4 text-surface-500" /> : <ChevronRight className="w-4 h-4 text-surface-500" />)}
      </div>
      {expanded && (
        <div className="border-t border-surface-700/50 px-4 py-3 bg-surface-900/50 space-y-3">
          <p className="text-sm text-surface-400">{endpoint.description}</p>
          {endpoint.queryParams && (
            <div>
              <div className="text-xs font-medium text-surface-300 mb-2">Query Parameters</div>
              <div className="space-y-1">
                {endpoint.queryParams.map(p => (
                  <div key={p.name} className="flex gap-3 text-xs">
                    <code className="text-blue-400 w-24 shrink-0">{p.name}</code>
                    <span className="text-surface-500 w-20 shrink-0">{p.type}</span>
                    <span className="text-surface-400">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {endpoint.body && (
            <div>
              <div className="text-xs font-medium text-surface-300 mb-2">Request Body (JSON)</div>
              <div className="space-y-1">
                {endpoint.body.map(p => (
                  <div key={p.name} className="flex gap-3 text-xs">
                    <code className={`w-32 shrink-0 ${p.required ? 'text-white font-medium' : 'text-blue-400'}`}>
                      {p.name}{p.required ? ' *' : ''}
                    </code>
                    <span className="text-surface-500 w-20 shrink-0">{p.type}</span>
                    <span className="text-surface-400">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {endpoint.response && (
            <div>
              <div className="text-xs font-medium text-surface-300 mb-1">Response</div>
              <code className="text-xs text-green-400">{endpoint.response}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  const [tab, setTab] = useState<'guide' | 'api'>('guide');
  const [activeSection, setActiveSection] = useState(0);

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Help & Documentation" subtitle="Product guide and API reference" />

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('guide')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'guide' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}>
          <Book className="w-4 h-4" /> Product Guide
        </button>
        <button onClick={() => setTab('api')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'api' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-surface-400 hover:text-white hover:bg-surface-800'}`}>
          <Code className="w-4 h-4" /> API Reference
        </button>
        <Link href="/help/docs"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 text-surface-400 hover:text-white hover:bg-surface-800">
          <BookOpen className="w-4 h-4" /> Full Documentation
        </Link>
      </div>

      {tab === 'guide' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-1">
            {GUIDE_SECTIONS.map((s, i) => (
              <button key={i} onClick={() => setActiveSection(i)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === i ? 'bg-blue-500/15 text-blue-400' : 'text-surface-400 hover:text-white hover:bg-surface-800/50'}`}>
                {s.title}
              </button>
            ))}
          </div>
          <div className="lg:col-span-3 glass rounded-xl p-8">
            <div className="prose prose-invert max-w-none text-surface-300 leading-relaxed">
              {GUIDE_SECTIONS[activeSection]?.content.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold text-white mb-4 mt-0">{line.replace('## ', '')}</h2>;
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold text-white">{line.replace(/\*\*/g, '')}</p>;
                if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-1">{line.replace('- ', '')}</li>;
                if (line.match(/^\d+\./)) return <li key={i} className="ml-4 mb-2 list-decimal">{line.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</li>;
                if (line.trim() === '') return <br key={i} />;
                return <p key={i} className="mb-2">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'api' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-surface-400">
              <Code className="w-4 h-4" />
              <span>Base URL:</span>
              <code className="text-surface-200 bg-surface-800 px-2 py-0.5 rounded font-mono">/api</code>
              <span className="ml-2">All endpoints require authentication via session cookie.</span>
            </div>
          </div>

          {API_DOCS.map((section, i) => (
            <div key={i} className="glass rounded-xl p-6">
              <div className="flex items-center gap-3 mb-1">
                <section.icon className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              </div>
              <p className="text-sm text-surface-400 mb-4">{section.description}</p>
              <div className="space-y-2">
                {section.endpoints.map((ep, j) => <EndpointCard key={j} endpoint={ep} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
