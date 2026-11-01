'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui';

// ---------------------------------------------------------------------------
// Endpoint definitions
// ---------------------------------------------------------------------------

interface EndpointParam {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  queryParams?: EndpointParam[];
  bodyParams?: EndpointParam[];
  requestExample?: string;
  responseExample?: string;
}

interface EndpointGroup {
  name: string;
  basePath: string;
  endpoints: Endpoint[];
}

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    name: 'Companies',
    basePath: '/api/companies',
    endpoints: [
      {
        method: 'GET',
        path: '/api/companies',
        description: 'List all companies with pagination and filtering.',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by name, email, or phone' },
          { name: 'type', type: 'string', description: 'Filter by type: customer, prospect, vendor, partner' },
          { name: 'status', type: 'string', description: 'Filter by status: active, inactive' },
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Items per page (default: 25)' },
          { name: 'sortBy', type: 'string', description: 'Sort field (default: createdAt)' },
          { name: 'sortDir', type: 'string', description: 'Sort direction: asc or desc (default: desc)' },
        ],
        responseExample: '{\n  "items": [{ "id": "clx...", "name": "Acme Corp", "type": "customer", ... }],\n  "total": 100,\n  "page": 1,\n  "limit": 25,\n  "pages": 4\n}',
      },
      {
        method: 'POST',
        path: '/api/companies',
        description: 'Create a new company. Auto-creates a default "Main" site.',
        bodyParams: [
          { name: 'name', type: 'string', description: 'Company name', required: true },
          { name: 'type', type: 'string', description: 'Type: prospect, customer, vendor, partner' },
          { name: 'email', type: 'string', description: 'Primary email' },
          { name: 'phone', type: 'string', description: 'Primary phone' },
          { name: 'website', type: 'string', description: 'Website URL' },
          { name: 'address1', type: 'string', description: 'Address line 1' },
          { name: 'city', type: 'string', description: 'City' },
          { name: 'state', type: 'string', description: 'State/Region' },
          { name: 'postcode', type: 'string', description: 'Postcode/ZIP' },
          { name: 'country', type: 'string', description: 'Country' },
        ],
        requestExample: '{\n  "name": "Acme Corp",\n  "type": "customer",\n  "email": "info@acme.com"\n}',
        responseExample: '{\n  "id": "clx...",\n  "name": "Acme Corp",\n  "type": "customer",\n  ...\n}',
      },
      {
        method: 'PATCH',
        path: '/api/companies/:id',
        description: 'Update a company by ID.',
        bodyParams: [
          { name: 'name', type: 'string', description: 'Company name' },
          { name: 'type', type: 'string', description: 'Type' },
          { name: 'email', type: 'string', description: 'Email' },
        ],
        requestExample: '{\n  "name": "Acme Corp Updated"\n}',
      },
      {
        method: 'DELETE',
        path: '/api/companies/:id',
        description: 'Delete a company by ID.',
      },
    ],
  },
  {
    name: 'Contacts',
    basePath: '/api/contacts',
    endpoints: [
      {
        method: 'GET',
        path: '/api/contacts',
        description: 'List all contacts with pagination and filtering.',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by name or email' },
          { name: 'companyId', type: 'string', description: 'Filter by company' },
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Items per page (default: 25)' },
        ],
        responseExample: '{\n  "items": [{ "id": "clx...", "firstName": "John", "lastName": "Doe", ... }],\n  "total": 50,\n  "page": 1,\n  "limit": 25,\n  "pages": 2\n}',
      },
      {
        method: 'POST',
        path: '/api/contacts',
        description: 'Create a new contact.',
        bodyParams: [
          { name: 'firstName', type: 'string', description: 'First name', required: true },
          { name: 'lastName', type: 'string', description: 'Last name', required: true },
          { name: 'email', type: 'string', description: 'Email address' },
          { name: 'phone', type: 'string', description: 'Phone number' },
          { name: 'companyId', type: 'string', description: 'Associated company ID' },
        ],
        requestExample: '{\n  "firstName": "John",\n  "lastName": "Doe",\n  "email": "john@acme.com",\n  "companyId": "clx..."\n}',
      },
    ],
  },
  {
    name: 'Tickets',
    basePath: '/api/tickets',
    endpoints: [
      {
        method: 'GET',
        path: '/api/tickets',
        description: 'List all tickets with pagination and filtering.',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by subject or description' },
          { name: 'status', type: 'string', description: 'Filter by status' },
          { name: 'companyId', type: 'string', description: 'Filter by company' },
          { name: 'assigneeId', type: 'string', description: 'Filter by assigned user' },
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Items per page (default: 25)' },
        ],
        responseExample: '{\n  "items": [{ "id": "clx...", "subject": "Server down", "status": "open", ... }],\n  "total": 200,\n  "page": 1,\n  "limit": 25,\n  "pages": 8\n}',
      },
      {
        method: 'POST',
        path: '/api/tickets',
        description: 'Create a new ticket.',
        bodyParams: [
          { name: 'subject', type: 'string', description: 'Ticket subject', required: true },
          { name: 'description', type: 'string', description: 'Ticket description' },
          { name: 'companyId', type: 'string', description: 'Company ID' },
          { name: 'contactId', type: 'string', description: 'Contact ID' },
          { name: 'priority', type: 'string', description: 'Priority: low, medium, high, critical' },
          { name: 'queueId', type: 'string', description: 'Queue ID' },
        ],
        requestExample: '{\n  "subject": "Email not working",\n  "description": "User cannot send emails since this morning",\n  "companyId": "clx...",\n  "priority": "high"\n}',
      },
    ],
  },
  {
    name: 'Quotes',
    basePath: '/api/quotes',
    endpoints: [
      {
        method: 'GET',
        path: '/api/quotes',
        description: 'List all quotes with pagination.',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by quote number or company' },
          { name: 'status', type: 'string', description: 'Filter by status: draft, sent, accepted, declined' },
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Items per page (default: 25)' },
        ],
        responseExample: '{\n  "items": [{ "id": "clx...", "quoteNumber": "Q-001", "status": "draft", ... }],\n  "total": 30,\n  "page": 1,\n  "limit": 25,\n  "pages": 2\n}',
      },
      {
        method: 'POST',
        path: '/api/quotes',
        description: 'Create a new quote.',
        bodyParams: [
          { name: 'companyId', type: 'string', description: 'Company ID', required: true },
          { name: 'contactId', type: 'string', description: 'Contact ID' },
          { name: 'items', type: 'array', description: 'Array of quote line items' },
        ],
        requestExample: '{\n  "companyId": "clx...",\n  "items": [{ "productId": "clx...", "quantity": 5 }]\n}',
      },
    ],
  },
  {
    name: 'Invoices',
    basePath: '/api/invoices',
    endpoints: [
      {
        method: 'GET',
        path: '/api/invoices',
        description: 'List all invoices with pagination.',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by invoice number or company' },
          { name: 'status', type: 'string', description: 'Filter by status: draft, sent, paid, overdue' },
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Items per page (default: 25)' },
        ],
        responseExample: '{\n  "items": [{ "id": "clx...", "invoiceNumber": "INV-001", "status": "sent", ... }],\n  "total": 45,\n  "page": 1,\n  "limit": 25,\n  "pages": 2\n}',
      },
    ],
  },
  {
    name: 'Products',
    basePath: '/api/products',
    endpoints: [
      {
        method: 'GET',
        path: '/api/products',
        description: 'List all products and services.',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by name or SKU' },
          { name: 'type', type: 'string', description: 'Filter by type: product, service, recurring' },
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Items per page (default: 25)' },
        ],
        responseExample: '{\n  "items": [{ "id": "clx...", "name": "IT Support", "type": "service", "price": 150.00, ... }],\n  "total": 20,\n  "page": 1,\n  "limit": 25,\n  "pages": 1\n}',
      },
      {
        method: 'POST',
        path: '/api/products',
        description: 'Create a new product or service.',
        bodyParams: [
          { name: 'name', type: 'string', description: 'Product name', required: true },
          { name: 'type', type: 'string', description: 'Type: product, service, recurring' },
          { name: 'price', type: 'number', description: 'Unit price' },
          { name: 'sku', type: 'string', description: 'SKU code' },
        ],
        requestExample: '{\n  "name": "Managed IT Support",\n  "type": "recurring",\n  "price": 150.00\n}',
      },
    ],
  },
  {
    name: 'Contracts',
    basePath: '/api/contracts',
    endpoints: [
      {
        method: 'GET',
        path: '/api/contracts',
        description: 'List all contracts with pagination.',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by contract name or company' },
          { name: 'status', type: 'string', description: 'Filter by status' },
          { name: 'companyId', type: 'string', description: 'Filter by company' },
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Items per page (default: 25)' },
        ],
        responseExample: '{\n  "items": [{ "id": "clx...", "name": "Support Agreement", "status": "active", ... }],\n  "total": 15,\n  "page": 1,\n  "limit": 25,\n  "pages": 1\n}',
      },
    ],
  },
  {
    name: 'Assets',
    basePath: '/api/assets',
    endpoints: [
      {
        method: 'GET',
        path: '/api/assets',
        description: 'List all assets / configuration items.',
        queryParams: [
          { name: 'search', type: 'string', description: 'Search by name, hostname, or serial number' },
          { name: 'companyId', type: 'string', description: 'Filter by company' },
          { name: 'type', type: 'string', description: 'Filter by type: device, server, network, software' },
          { name: 'status', type: 'string', description: 'Filter by status: active, inactive, retired' },
          { name: 'rmmSource', type: 'string', description: 'Filter by RMM source: ninja, datto' },
          { name: 'page', type: 'number', description: 'Page number (default: 1)' },
          { name: 'limit', type: 'number', description: 'Items per page (default: 25)' },
        ],
        responseExample: '{\n  "items": [{ "id": "clx...", "name": "DESKTOP-01", "type": "device", "status": "active", ... }],\n  "total": 150,\n  "page": 1,\n  "limit": 25,\n  "pages": 6\n}',
      },
      {
        method: 'POST',
        path: '/api/assets',
        description: 'Create a new asset.',
        bodyParams: [
          { name: 'name', type: 'string', description: 'Asset name', required: true },
          { name: 'companyId', type: 'string', description: 'Company ID' },
          { name: 'type', type: 'string', description: 'Asset type' },
          { name: 'manufacturer', type: 'string', description: 'Manufacturer' },
          { name: 'model', type: 'string', description: 'Model' },
          { name: 'serialNumber', type: 'string', description: 'Serial number' },
        ],
        requestExample: '{\n  "name": "DESKTOP-01",\n  "companyId": "clx...",\n  "type": "device",\n  "manufacturer": "Dell",\n  "model": "OptiPlex 7090"\n}',
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400',
  POST: 'bg-blue-500/20 text-blue-400',
  PATCH: 'bg-amber-500/20 text-amber-400',
  PUT: 'bg-amber-500/20 text-amber-400',
  DELETE: 'bg-red-500/20 text-red-400',
};

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/5 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${METHOD_COLORS[endpoint.method] || 'bg-white/10 text-white'}`}>
          {endpoint.method}
        </span>
        <code className="text-sm text-white font-mono flex-1">{endpoint.path}</code>
        <span className="text-slate-400 text-sm hidden sm:block">{endpoint.description}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
          <p className="text-sm text-slate-300">{endpoint.description}</p>

          {endpoint.queryParams && endpoint.queryParams.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Query Parameters</h4>
              <div className="space-y-1">
                {endpoint.queryParams.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-sm">
                    <code className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded text-xs">{p.name}</code>
                    <span className="text-slate-500 text-xs">({p.type})</span>
                    <span className="text-slate-400">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.bodyParams && endpoint.bodyParams.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Body Parameters</h4>
              <div className="space-y-1">
                {endpoint.bodyParams.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-sm">
                    <code className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded text-xs">{p.name}</code>
                    <span className="text-slate-500 text-xs">({p.type})</span>
                    {p.required && <span className="text-red-400 text-xs">required</span>}
                    <span className="text-slate-400">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.requestExample && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Request Body</h4>
              <pre className="bg-black/30 rounded-lg p-3 text-sm text-slate-300 font-mono overflow-x-auto border border-white/5">
                {endpoint.requestExample}
              </pre>
            </div>
          )}

          {endpoint.responseExample && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-2">Response</h4>
              <pre className="bg-black/30 rounded-lg p-3 text-sm text-slate-300 font-mono overflow-x-auto border border-white/5">
                {endpoint.responseExample}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ApiDocsPage() {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Companies');

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="API Documentation"
        subtitle="Integrate with the Xanty PSA REST API"
        actions={
          <a
            href="/settings/api-keys"
            className="text-sm px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
          >
            Manage API Keys
          </a>
        }
      />

      {/* Authentication info */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">Authentication</h2>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-slate-300">Base URL:</span>
            <code className="ml-2 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/api</code>
          </div>
          <div>
            <span className="text-slate-300">Header:</span>
            <code className="ml-2 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono">X-API-Key: your_api_key_here</code>
          </div>
          <p className="text-slate-400">
            All API requests require authentication via an API key passed in the <code className="text-blue-400">X-API-Key</code> header,
            or via an active session cookie. Create and manage API keys in the{' '}
            <a href="/settings/api-keys" className="text-blue-400 hover:text-blue-300 underline">
              API Keys
            </a>{' '}
            settings page.
          </p>
          <div className="bg-black/30 rounded-lg p-3 font-mono text-xs text-slate-300 border border-white/5">
            <div className="text-slate-500"># Example request</div>
            <div>curl -H &quot;X-API-Key: vp_abc123...&quot; \</div>
            <div className="pl-4">{typeof window !== 'undefined' ? window.location.origin : 'https://your-instance.vibepsa.net'}/api/companies</div>
          </div>
        </div>
      </div>

      {/* Pagination info */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">Pagination &amp; Filtering</h2>
        <p className="text-sm text-slate-400 mb-3">
          All list endpoints support pagination and return a consistent response envelope.
        </p>
        <pre className="bg-black/30 rounded-lg p-3 text-sm text-slate-300 font-mono overflow-x-auto border border-white/5">
{`{
  "items": [...],       // Array of records
  "total": 100,         // Total matching records
  "page": 1,            // Current page
  "limit": 25,          // Items per page
  "pages": 4            // Total pages
}`}
        </pre>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex gap-2">
            <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono text-xs">?page=2</code>
            <span className="text-slate-400">Navigate to page 2</span>
          </div>
          <div className="flex gap-2">
            <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono text-xs">?limit=50</code>
            <span className="text-slate-400">Return 50 items per page</span>
          </div>
          <div className="flex gap-2">
            <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-mono text-xs">?sortBy=name&amp;sortDir=asc</code>
            <span className="text-slate-400">Sort by name ascending</span>
          </div>
        </div>
      </div>

      {/* Endpoint groups */}
      <div className="space-y-4 mb-8">
        {ENDPOINT_GROUPS.map((group) => (
          <div key={group.name} className="glass rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedGroup(expandedGroup === group.name ? null : group.name)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <h3 className="text-white font-semibold">{group.name}</h3>
                <span className="text-xs text-slate-500 font-mono">{group.basePath}</span>
                <span className="text-xs bg-white/10 text-slate-400 px-2 py-0.5 rounded-full">
                  {group.endpoints.length} endpoint{group.endpoints.length !== 1 ? 's' : ''}
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-slate-400 transition-transform ${expandedGroup === group.name ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {expandedGroup === group.name && (
              <div className="px-6 pb-4 space-y-2">
                {group.endpoints.map((ep, i) => (
                  <EndpointCard key={i} endpoint={ep} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MCP Server info */}
      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-block w-3 h-3 rounded-full bg-purple-400" />
          <h2 className="text-lg font-semibold text-white">MCP Server</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          Xanty PSA includes an MCP (Model Context Protocol) server for AI integration.
          Connect AI assistants directly to your PSA data.
        </p>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-slate-300">Connection:</span>
            <code className="ml-2 text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded font-mono">stdio</code>
            <span className="mx-1 text-slate-500">or</span>
            <code className="text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded font-mono">HTTP</code>
          </div>
          <div>
            <span className="text-slate-300 block mb-2">Available Tools:</span>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {[
                'list_companies',
                'get_company',
                'create_company',
                'list_contacts',
                'get_contact',
                'create_contact',
                'list_tickets',
                'get_ticket',
                'create_ticket',
                'update_ticket',
                'list_quotes',
                'list_invoices',
                'list_contracts',
                'list_products',
                'list_assets',
                'list_opportunities',
              ].map((tool) => (
                <code key={tool} className="text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded font-mono">
                  {tool}
                </code>
              ))}
            </div>
          </div>
          <div className="mt-4 bg-black/30 rounded-lg p-3 font-mono text-xs text-slate-300 border border-white/5">
            <div className="text-slate-500"># Claude Desktop config example</div>
            <div>{`{`}</div>
            <div className="pl-4">{`"mcpServers": {`}</div>
            <div className="pl-8">{`"xantypsa": {`}</div>
            <div className="pl-12">{`"command": "npx",`}</div>
            <div className="pl-12">{`"args": ["xantypsa-mcp"],`}</div>
            <div className="pl-12">{`"env": { "XANTYPSA_API_KEY": "vp_abc123..." }`}</div>
            <div className="pl-8">{`}`}</div>
            <div className="pl-4">{`}`}</div>
            <div>{`}`}</div>
          </div>
        </div>
      </div>

      {/* Webhooks info */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-3">Webhooks</h2>
        <p className="text-sm text-slate-400 mb-3">
          Xanty PSA can send HTTP POST requests to your endpoints when events occur.
          Configure webhooks in the{' '}
          <a href="/settings/webhooks" className="text-blue-400 hover:text-blue-300 underline">
            Webhooks
          </a>{' '}
          settings page.
        </p>
        <div className="text-sm text-slate-300 space-y-1">
          <p>Supported events:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-2">
            {[
              'company.created',
              'company.updated',
              'contact.created',
              'contact.updated',
              'ticket.created',
              'ticket.updated',
              'quote.created',
              'quote.updated',
              'invoice.created',
              'invoice.paid',
              'contract.created',
              'contract.updated',
            ].map((event) => (
              <code key={event} className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded font-mono">
                {event}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
