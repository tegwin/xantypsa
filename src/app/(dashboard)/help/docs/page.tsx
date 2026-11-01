'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui';
import {
  ChevronDown, ChevronRight, LayoutDashboard, Building2, Users, Target,
  LifeBuoy, FileText, Receipt, Package, CreditCard, Monitor, FolderKanban,
  Shield, Mail, Sliders, Webhook, Key, Zap, Upload, Globe, Code,
  Search, BookOpen
} from 'lucide-react';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          The Dashboard is your command centre for the entire PSA platform. It provides a real-time overview of key performance
          indicators, including open ticket counts, revenue metrics, contract utilisation, and project progress. At a glance you can
          see how your service delivery is performing across all clients.
        </p>
        <p>
          Quick-action cards let you jump straight to common tasks such as creating a new ticket, generating an invoice, or adding
          a time entry. The dashboard is personalised to your role, so technicians see their assigned tickets and time tracking
          summaries, while managers see financial KPIs and team utilisation rates.
        </p>
        <p>
          Revenue widgets display monthly recurring revenue (MRR), outstanding invoice totals, and overdue amounts. Ticket
          widgets show open vs closed ratios, SLA compliance, and average resolution times. Contract widgets highlight
          pre-pay hour blocks that are running low and contracts approaching renewal dates.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Use the dashboard as your starting point each day to triage priorities.</li>
          <li>Click any KPI card to drill down into the underlying data.</li>
          <li>Widgets update in real time as your team logs work.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Tickets, Contracts, Invoices, Reports</p>
      </div>
    ),
  },
  {
    id: 'companies',
    title: 'CRM - Companies',
    icon: <Building2 className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          The Companies module is where you manage all of your client organisations. Each company record stores essential details
          like company name, address fields (street, city, county, postcode, country), phone numbers, email addresses, websites,
          and custom fields. Companies are the top-level entity that contacts, contracts, tickets, and invoices are linked to.
        </p>
        <p>
          When viewing a company, you will see tabs for Contacts (people at that company), Contracts (active agreements),
          Tickets (support requests), Invoices, Assets, and Activity. This gives you a 360-degree view of your relationship
          with each client. You can also add notes and custom fields to track anything specific to your business.
        </p>
        <p>
          Bulk import is supported via CSV, making it easy to migrate from another system. Companies can be filtered by status,
          type, or any custom field. The search bar supports fuzzy matching on company name and all address fields.
        </p>
        <p>
          Companies can be linked to opportunities in the CRM pipeline, allowing you to track the full lifecycle from prospect
          to paying client. When a deal closes, the company is already set up with all their information ready to go.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Always fill in the full address for accurate reporting and mail merge.</li>
          <li>Use custom fields to track industry, account manager, or SLA tier.</li>
          <li>Link companies to contracts before logging tickets for proper billing.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Contacts, Contracts, Tickets, Assets</p>
      </div>
    ),
  },
  {
    id: 'contacts',
    title: 'CRM - Contacts',
    icon: <Users className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Contacts represent individual people within your client companies. Each contact has a name, email, phone number, job
          title, and role designation. Contacts are linked to companies, and you can have multiple contacts per company. Each
          contact can be flagged as primary, technical, or billing to help your team know who to reach for different purposes.
        </p>
        <p>
          When a contact emails your service desk, the system automatically matches them to their company and creates tickets
          under the correct account. Contacts can also log into the Customer Portal to view their tickets, approve quotes, and
          access shared documents. The portal access is controlled per contact.
        </p>
        <p>
          Contacts can be assigned to tickets as the requester or CC participant. They receive email notifications about
          ticket updates, invoice deliveries, and quote approvals. You can manage notification preferences per contact to
          control what communications they receive.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Set a primary contact for each company for default communications.</li>
          <li>Enable portal access for key contacts to reduce inbound calls.</li>
          <li>Use bulk import to load contact lists from CSV files.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Companies, Customer Portal, Tickets</p>
      </div>
    ),
  },
  {
    id: 'opportunities',
    title: 'CRM - Opportunities',
    icon: <Target className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Opportunities track your sales pipeline from initial lead through to closed deal. Each opportunity has a name, value,
          expected close date, stage, and probability. Stages are customisable and typically include Lead, Qualified, Proposal,
          Negotiation, and Closed Won/Lost. You can view your pipeline as a list or as a visual Kanban board.
        </p>
        <p>
          The Kanban view shows opportunities as cards that you can drag between stages. Each card displays the company name,
          deal value, and expected close date. The pipeline gives you a visual overview of your sales funnel and helps identify
          bottlenecks where deals are stalling.
        </p>
        <p>
          Opportunities are linked to companies and contacts, and you can convert a won opportunity into a contract and quote
          with one click. Activity logging lets you track calls, emails, and meetings against each opportunity so nothing
          falls through the cracks.
        </p>
        <p>
          Pipeline reports show total pipeline value by stage, win rates, average deal size, and sales velocity metrics. These
          help you forecast revenue and measure sales team performance.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Keep opportunity values and close dates up to date for accurate forecasting.</li>
          <li>Use the Kanban board for daily pipeline reviews.</li>
          <li>Link opportunities to quotes for a seamless sales-to-delivery workflow.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Companies, Contacts, Quotes, Contracts</p>
      </div>
    ),
  },
  {
    id: 'tickets',
    title: 'Service Desk - Tickets',
    icon: <LifeBuoy className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          The Ticket system is the core of your service delivery. Tickets can be created manually, via email integration, or
          through the customer portal. Each ticket has a title, description, status, priority (critical, high, medium, low),
          type (incident, service request, problem, change), and assignment to a technician or team.
        </p>
        <p>
          The status workflow typically follows: New, In Progress, Waiting on Client, Waiting on Third Party, Resolved, and
          Closed. Each status transition can be configured with required fields and approval steps. Tickets support rich notes
          (internal and public), file attachments, and time entries for billing.
        </p>
        <p>
          Time entries logged against tickets are the foundation of billing. When a ticket is linked to a contract, time entries
          are automatically handled according to the contract type. For pre-pay hours contracts, time deducts from the block.
          For T&M contracts, time is billable at the assigned rate. For managed service contracts, time is covered.
        </p>
        <p>
          SLA tracking monitors response and resolution times against your service level agreements. Tickets approaching or
          breaching SLA targets are highlighted in the queue. Email notifications keep clients updated on progress.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Always link tickets to the correct contract for accurate billing.</li>
          <li>Use internal notes for team communication, public notes for client updates.</li>
          <li>Log time entries as you work to avoid forgotten billable hours.</li>
          <li>Set priorities accurately to drive SLA tracking and queue ordering.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Contracts, Time Entries, Invoices, Email Processing</p>
      </div>
    ),
  },
  {
    id: 'contracts',
    title: 'Contracts',
    icon: <FileText className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Contracts define the commercial terms between you and your clients. Xanty PSA supports four contract types: Time &
          Materials (T&M), Fixed Price, Pre-Pay Hours, and Managed Service. Each type has specific billing behaviour that
          determines how time entries logged against tickets are charged.
        </p>
        <p>
          <strong className="text-white/70">Time & Materials:</strong> Every hour logged is billable at the applicable billing
          rate. Invoices are generated based on accumulated time entries. This is the simplest model for ad-hoc work.
        </p>
        <p>
          <strong className="text-white/70">Fixed Price:</strong> A total project value is agreed upfront. Billing can be
          one-off or split into milestones/instalments. The milestone billing feature allows you to create a schedule of
          payments tied to project phases, with each milestone invoiced individually.
        </p>
        <p>
          <strong className="text-white/70">Pre-Pay Hours:</strong> The client purchases a block of hours upfront. Time
          logged against tickets deducts from the block. When the block runs low (based on alert threshold), you are notified.
          Overage rates can be configured for work beyond the purchased block. Blocks can be topped up at any time.
        </p>
        <p>
          <strong className="text-white/70">Managed Service:</strong> All labour is covered under a flat monthly fee. Time
          entries are tracked but not billed individually. Billing is handled via recurring invoices for the monthly fee.
          Specific billing rates can be excluded from coverage and charged as T&M.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Use rate exclusions to handle out-of-scope work on managed contracts.</li>
          <li>Set alert thresholds on pre-pay blocks to notify before hours run out.</li>
          <li>For fixed-price contracts, use milestone billing to match payments to deliverables.</li>
          <li>Link project milestones to billing milestones for complete traceability.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Tickets, Invoices, Billing Rates, Projects</p>
      </div>
    ),
  },
  {
    id: 'quotes',
    title: 'Quotes',
    icon: <Receipt className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          The Quote Builder lets you create professional proposals and estimates for your clients. Each quote has line items
          with descriptions, quantities, unit prices, tax rates, and discounts. Quotes can include products from your catalog
          or custom line items. The builder supports drag-and-drop reordering of items.
        </p>
        <p>
          Quotes move through statuses: Draft, Sent, Viewed, Accepted, Rejected, and Expired. When you send a quote, the
          client receives an email with a link to view it in the Customer Portal. They can accept or reject the quote with
          an optional digital signature capture. You receive notifications when a quote is viewed or actioned.
        </p>
        <p>
          PDF generation creates a branded document with your company logo, terms and conditions, and all line item details.
          Quote templates allow you to customise the look and feel of your documents. Multiple templates can be created for
          different use cases (e.g., project proposals vs. hardware quotes).
        </p>
        <p>
          The Quotes Dashboard provides pipeline analytics including total quoted value, conversion rates, and average quote
          size. The Kanban view shows quotes grouped by status for easy visual management.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Use products from your catalog for consistent pricing across quotes.</li>
          <li>Enable signature capture for legally binding acceptances.</li>
          <li>Set expiry dates to create urgency and keep your pipeline clean.</li>
          <li>Convert accepted quotes to contracts and invoices in one step.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Products, Contracts, Invoices, Customer Portal</p>
      </div>
    ),
  },
  {
    id: 'products',
    title: 'Products',
    icon: <Package className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          The Product Catalog is a central repository for all the goods and services you sell. Each product has a name,
          description, SKU, category, unit price, cost price, and tax rate. Products can be marked as services (labour,
          consulting) or physical products (hardware, licenses). This distinction affects how they appear on quotes and invoices.
        </p>
        <p>
          Products support multiple billing types: one-time, recurring (monthly, quarterly, annually), and usage-based. Recurring
          products are automatically included in recurring invoice generation. Usage-based products can be tied to metered
          consumption data.
        </p>
        <p>
          When building quotes or invoices, you can search and add products from the catalog. This ensures consistent pricing
          and descriptions across all your client-facing documents. Products can also be grouped into bundles for common
          combinations of services and hardware.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Keep cost prices updated to track margins on quotes and invoices.</li>
          <li>Use categories to organise products (e.g., Hardware, Software, Services).</li>
          <li>Set default tax rates per product to save time when quoting.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Quotes, Invoices, Billing</p>
      </div>
    ),
  },
  {
    id: 'invoices',
    title: 'Invoices',
    icon: <CreditCard className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          The Invoicing module handles all aspects of billing your clients. Invoices can be created manually, generated from
          contracts (for recurring billing), or created from milestone billing on fixed-price contracts. Each invoice has
          line items, tax calculations, payment terms, and a due date.
        </p>
        <p>
          Invoice statuses track the lifecycle: Draft, Sent, Viewed, Partially Paid, Paid, Overdue, and Void. Payment
          recording lets you log partial or full payments against invoices, automatically updating the balance due. Overdue
          invoices are highlighted in the invoice list and on the dashboard.
        </p>
        <p>
          Recurring invoices are automatically generated based on the billing cycle defined on contracts. This is ideal for
          managed service contracts with monthly fees. The system generates the invoice and optionally sends it to the client
          via email on the billing date.
        </p>
        <p>
          The Ready for Invoicing queue shows all billable work that has not yet been invoiced, grouped by company and
          contract. This makes it easy to review pending charges before generating invoices in bulk.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Use the Ready for Invoicing queue to catch all billable work before month-end.</li>
          <li>Set payment terms per invoice or use defaults from company settings.</li>
          <li>Record payments promptly to keep your aged debt reporting accurate.</li>
          <li>Use recurring invoices for managed service contracts to automate billing.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Contracts, Billing Rates, Products, Quotes</p>
      </div>
    ),
  },
  {
    id: 'assets',
    title: 'Assets',
    icon: <Monitor className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Asset Management tracks all hardware, software, and other IT assets across your client base. Each asset has a name,
          type, serial number, manufacturer, model, purchase date, warranty expiry, and location. Assets are linked to companies
          and can be associated with contacts (the primary user) and tickets (for issue tracking).
        </p>
        <p>
          The asset list supports filtering by company, type, status, and warranty status. You can quickly identify assets with
          expiring warranties or those that are due for replacement. Custom fields allow you to track any additional attributes
          specific to your business needs.
        </p>
        <p>
          RMM (Remote Monitoring and Management) integration enables automatic asset synchronisation from tools like Datto,
          NinjaRMM, or ConnectWise Automate. When configured, assets are automatically created and updated with real-time
          data from your monitoring platform, eliminating manual data entry.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Link assets to tickets for complete incident tracking and history.</li>
          <li>Set warranty expiry dates to proactively manage renewals.</li>
          <li>Use RMM integration to keep your asset database current automatically.</li>
          <li>Use custom fields for tracking details like IP addresses, locations, or licence keys.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Companies, Tickets, Integrations, Custom Fields</p>
      </div>
    ),
  },
  {
    id: 'projects',
    title: 'Projects',
    icon: <FolderKanban className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Project Management in Xanty PSA provides tools for planning, tracking, and delivering client projects. Each project
          has a name, description, manager, status, priority, budget (hours and/or monetary), start and end dates, and a
          billing method (fixed price, time & materials, or retainer).
        </p>
        <p>
          Projects are broken down into Milestones and Tasks. Milestones represent major phases or deliverables (e.g.,
          Discovery, Development, Testing, Go-Live). Tasks are individual work items assigned to team members with due
          dates and estimated hours. The Kanban board provides a visual view of task status across the project.
        </p>
        <p>
          Time entries can be logged directly against project tasks, which feeds into budget tracking and billing. The
          project dashboard shows progress percentage, hours burned vs. budget, and timeline adherence. Gantt chart
          views help visualise task dependencies and the overall project timeline.
        </p>
        <p>
          Project milestones can be linked to billing milestones on fixed-price contracts. This creates a direct connection
          between project delivery and revenue recognition. When a project milestone is completed, the corresponding billing
          milestone can be invoiced.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Break projects into milestones to track progress at a high level.</li>
          <li>Use task assignments and due dates to keep the team accountable.</li>
          <li>Link project milestones to contract milestones for billing alignment.</li>
          <li>Monitor budget burn rate to catch overruns early.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Contracts, Milestones, Tasks, Time Entries</p>
      </div>
    ),
  },
  {
    id: 'users-roles',
    title: 'Settings - Users & Roles',
    icon: <Shield className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          User Management allows administrators to create, edit, and deactivate user accounts. Each user has a name, email,
          role, and active status. Users log in with their email and password, and sessions are managed via secure
          authentication tokens.
        </p>
        <p>
          Roles define what each user can see and do within the system. Each role has a permission matrix that controls
          access to modules (CRM, Service Desk, Contracts, Invoices, Projects, Reports, Settings) and actions (read, write,
          delete) within each module. The Super Admin role has unrestricted access to all features.
        </p>
        <p>
          Common role configurations include: Admin (full access), Manager (read/write to most modules, no settings),
          Technician (service desk and time tracking), and Sales (CRM and quotes). You can create custom roles tailored
          to your team structure and security requirements.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Follow the principle of least privilege when assigning roles.</li>
          <li>Create specific roles for different job functions rather than using Admin for everyone.</li>
          <li>Deactivate user accounts rather than deleting them to preserve audit history.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Settings, Audit Logs</p>
      </div>
    ),
  },
  {
    id: 'email',
    title: 'Settings - Email',
    icon: <Mail className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Email settings configure how Xanty PSA sends and receives email. Outgoing email can be configured via SMTP or
          Microsoft 365 Graph API integration. SMTP requires a server address, port, username, and password. Microsoft
          365 integration uses OAuth for secure, modern authentication.
        </p>
        <p>
          Email templates control the formatting and content of automated emails sent by the system. Templates are available
          for ticket notifications (new, updated, resolved), invoice delivery, quote delivery, and portal invitations. Each
          template supports merge fields that are replaced with actual data when sent (e.g., ticket number, client name).
        </p>
        <p>
          Email Processing enables automatic ticket creation from inbound emails. When configured, emails sent to your support
          address are parsed and converted into tickets. The system matches the sender to an existing contact and company,
          sets the appropriate contract, and creates the ticket with the email body as the description. Replies to existing
          ticket notifications are threaded back as notes on the original ticket.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Test your SMTP settings with a test email before relying on automated sends.</li>
          <li>Customise email templates to match your brand voice and style.</li>
          <li>Use Microsoft 365 integration for better deliverability and modern auth.</li>
          <li>Configure email processing rules to route tickets to the correct queue.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Tickets, Email Templates, Microsoft 365</p>
      </div>
    ),
  },
  {
    id: 'custom-fields',
    title: 'Settings - Custom Fields',
    icon: <Sliders className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Custom Fields extend the data model of Xanty PSA to capture information unique to your business. You can add custom
          fields to Companies, Contacts, Tickets, Assets, Contracts, and other entities. Field types include text, number,
          date, dropdown (select), checkbox, and multi-select.
        </p>
        <p>
          Each custom field has a name, type, entity type (which record type it belongs to), and optional default value. For
          dropdown and multi-select fields, you define the available options. Custom fields appear on the relevant entity
          forms and detail pages, and their values are stored as structured JSON data.
        </p>
        <p>
          Custom field values can be used in filters, reports, and email template merge fields. This makes them a powerful
          tool for adapting the system to your workflows. Common use cases include tracking SLA tiers on companies, device
          warranty information on assets, and project-specific metadata on tickets.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Plan your custom field structure before creating fields to avoid duplicates.</li>
          <li>Use dropdown fields instead of text fields where possible for consistent data.</li>
          <li>Custom fields are included in CSV imports and exports.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Companies, Contacts, Tickets, Assets, Import</p>
      </div>
    ),
  },
  {
    id: 'webhooks',
    title: 'Settings - Webhooks',
    icon: <Webhook className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Webhooks allow Xanty PSA to notify external systems when events occur. You can configure outgoing webhooks that send
          HTTP POST requests to a URL of your choice when specific events are triggered. Supported events include ticket
          creation, ticket status changes, invoice creation, contract changes, and more.
        </p>
        <p>
          Each webhook has a target URL, a list of subscribed events, and an optional secret for request signing. When an event
          occurs, the system sends a JSON payload containing the event type and the full data of the affected record. The secret
          is used to generate an HMAC signature in the request headers so you can verify authenticity.
        </p>
        <p>
          A testing interface lets you send sample payloads to your endpoint to verify it is receiving and processing data
          correctly. Webhook delivery logs show the response status and any errors for each sent webhook, making troubleshooting
          straightforward.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Always set a webhook secret and validate the HMAC signature on your receiver.</li>
          <li>Use the test feature to verify your endpoint before subscribing to live events.</li>
          <li>Monitor webhook delivery logs for failed deliveries and fix endpoints promptly.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: API Keys, Integrations</p>
      </div>
    ),
  },
  {
    id: 'api-keys',
    title: 'Settings - API Keys',
    icon: <Key className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          API Keys provide programmatic access to the Xanty PSA API. Each key has a name, permission set, and expiry date.
          Keys are generated in the Settings area and displayed once at creation time. Store them securely as they cannot be
          retrieved after initial display.
        </p>
        <p>
          API keys are used in the Authorization header of HTTP requests as Bearer tokens. Each key can be scoped with
          specific permissions (read-only, read-write, or full access per module) so you can follow the principle of least
          privilege. Keys can be revoked at any time if compromised.
        </p>
        <p>
          Common use cases for API keys include integrating with external tools, automating data synchronisation, building
          custom dashboards, and connecting to third-party automation platforms like Zapier or Power Automate.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Create separate API keys for each integration for easier revocation.</li>
          <li>Set the minimum required permissions on each key.</li>
          <li>Rotate keys periodically and set expiry dates.</li>
          <li>Never expose API keys in client-side code or public repositories.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: API Documentation, Webhooks, Integrations</p>
      </div>
    ),
  },
  {
    id: 'integrations',
    title: 'Settings - Integrations',
    icon: <Zap className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Integrations connect Xanty PSA with external tools and platforms to streamline your workflows. Currently supported
          integrations include RMM tools (for asset synchronisation), accounting platforms (for invoice sync), and documentation
          systems (for knowledge base linking).
        </p>
        <p>
          RMM integrations (e.g., Datto RMM, NinjaRMM, ConnectWise Automate) automatically import and update asset records
          from your monitoring platform. This keeps your asset database current without manual data entry. Assets are matched
          by serial number or hostname and linked to the correct company.
        </p>
        <p>
          Accounting integrations (e.g., Xero, QuickBooks) sync invoices and payments between Xanty PSA and your accounting
          software. When an invoice is created or payment recorded in Xanty PSA, the corresponding transaction is created in
          your accounting platform, eliminating double entry.
        </p>
        <p>
          Documentation integrations (e.g., IT Glue, Hudu) link knowledge base articles to companies, assets, and tickets.
          Technicians can quickly access relevant documentation while working on issues.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Configure RMM sync schedules to balance freshness with API rate limits.</li>
          <li>Map companies between Xanty PSA and your accounting platform carefully.</li>
          <li>Test integrations with a small data set before enabling full synchronisation.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Assets, Invoices, API Keys</p>
      </div>
    ),
  },
  {
    id: 'import',
    title: 'Settings - Import',
    icon: <Upload className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          The Import tool lets you bulk-load data into Xanty PSA from CSV files. Supported entity types include Companies,
          Contacts, Assets, Tickets, and Products. Each import type has a specific column mapping that you configure during
          the import process.
        </p>
        <p>
          The import wizard walks you through uploading your CSV file, mapping columns to Xanty PSA fields, previewing the data,
          and executing the import. Validation runs before the import to catch errors like missing required fields, invalid
          email formats, or duplicate records. You can fix issues in the preview before committing.
        </p>
        <p>
          Import logs record every import operation with success and error counts. Failed rows are reported with specific
          error messages so you can correct the source data and re-import. Imports can be run incrementally to add new records
          without affecting existing data.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Download the sample CSV template for each entity type before preparing your data.</li>
          <li>Clean your data in a spreadsheet before importing to avoid errors.</li>
          <li>Import companies before contacts and assets so that relationships can be linked.</li>
          <li>Use a test import with a small file first to verify your column mapping.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Companies, Contacts, Assets, Custom Fields</p>
      </div>
    ),
  },
  {
    id: 'customer-portal',
    title: 'Customer Portal',
    icon: <Globe className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          The Customer Portal provides a self-service interface for your clients. Contacts with portal access enabled can log
          in to view their tickets, submit new support requests, review and approve quotes, and view invoice history. The
          portal is branded with your logo and colours for a professional appearance.
        </p>
        <p>
          When a quote is sent to a client, they receive an email with a link to view it in the portal. The portal displays
          the full quote with line items, totals, and terms. Clients can accept or reject the quote, and optionally provide
          a digital signature. Accepted quotes trigger a notification to your team for processing.
        </p>
        <p>
          The ticket view in the portal shows all tickets for the client's company (or just their own tickets, depending on
          the permission level). They can add notes, upload attachments, and see the status timeline. This reduces inbound
          calls and emails asking for status updates.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Enable portal access selectively for key contacts at each company.</li>
          <li>Customise the portal branding to match your company identity.</li>
          <li>Use the quote approval workflow to get faster sign-offs on proposals.</li>
          <li>Encourage clients to use the portal for ticket submissions to ensure proper logging.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: Contacts, Quotes, Tickets</p>
      </div>
    ),
  },
  {
    id: 'api-docs',
    title: 'API Documentation',
    icon: <Code className="w-4 h-4" />,
    content: (
      <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
        <p>
          Xanty PSA provides a REST API for programmatic access to all data and operations. The API uses JSON for request and
          response bodies, and authentication is handled via Bearer tokens (API Keys). All endpoints follow RESTful
          conventions with standard HTTP methods (GET, POST, PATCH, DELETE).
        </p>
        <p>
          Key API endpoint groups include: Companies (/api/companies), Contacts (/api/contacts), Tickets (/api/tickets),
          Contracts (/api/contracts), Invoices (/api/invoices), Products (/api/products), Assets (/api/assets), and Projects
          (/api/projects). Each supports list (GET), create (POST), update (PATCH), and delete (DELETE) operations.
        </p>
        <p>
          List endpoints support pagination (page, limit), searching (search parameter), filtering (status, type, companyId),
          and sorting (sortBy, sortDir). Responses include total count and page information for building paginated UIs.
        </p>
        <p>
          The interactive API documentation page (Settings &gt; API Docs) provides a searchable reference of all endpoints
          with request/response examples. You can test API calls directly from the documentation page using your API key.
        </p>
        <p className="text-white/70 font-medium">Key Tips:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>Use the interactive API docs to explore endpoints before writing integration code.</li>
          <li>Include error handling for 401 (unauthorised), 404 (not found), and 400 (validation) responses.</li>
          <li>Respect rate limits and implement exponential backoff for retries.</li>
          <li>Use webhooks for event-driven integrations rather than polling the API.</li>
        </ul>
        <p className="text-xs text-slate-500">Related: API Keys, Webhooks, Integrations</p>
      </div>
    ),
  },
];

export default function HelpDocsPage() {
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const toggleSection = (id: string) => {
    setOpenSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const expandAll = () => setOpenSections(HELP_SECTIONS.map(s => s.id));
  const collapseAll = () => setOpenSections([]);

  const filteredSections = search
    ? HELP_SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase())
      )
    : HELP_SECTIONS;

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Help Documentation" subtitle="Comprehensive guide to using Xanty PSA">
        <div className="flex gap-2">
          <button onClick={expandAll} className="btn-secondary text-sm">Expand All</button>
          <button onClick={collapseAll} className="btn-secondary text-sm">Collapse All</button>
        </div>
      </PageHeader>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search help topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filteredSections.map((section) => {
          const isOpen = openSections.includes(section.id);
          return (
            <div key={section.id} className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-blue-400">{section.icon}</span>
                <span className="flex-1 text-white font-medium text-sm">{section.title}</span>
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-surface-700/50">
                  {section.content}
                </div>
              )}
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="glass rounded-xl p-8 text-center">
            <BookOpen className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No help topics match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
