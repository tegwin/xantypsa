# Xanty PSA

**Open source PSA for MSPs.** A complete multi-tenant Professional Services
Automation platform - service desk, CRM, contracts, quoting, invoicing, projects
and time - that you self-host and own outright.

[![Licence: AGPL v3](https://img.shields.io/badge/licence-AGPL--3.0-blue.svg)](LICENSE)

- **Website:** https://xanty.net
- **Licence:** [AGPL-3.0](LICENSE) - free for commercial use, including running
  your own MSP on it
- **Status:** early. The modules below work, but this has not been hardened
  across hundreds of MSPs the way the commercial products have. Trial it
  alongside what you run today before trusting it with your billing.

Built in the open. Contributions welcome - see [CONTRIBUTING.md](CONTRIBUTING.md).

Copyright © 2026 The Xanty PSA Authors.

## Documentation

Full documentation lives in `docs/`, built with MkDocs Material.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-docs.txt
.venv/bin/mkdocs serve      # read locally at http://127.0.0.1:8000
.venv/bin/mkdocs build      # static HTML into site-docs/
```

| | |
|---|---|
| [Service desk](docs/SERVICE-DESK.md) | Public and private notes, the timer, statuses |
| [CRM](docs/CRM.md) | Companies, prospects, the sales pipeline, the funnel |
| [Profitability](docs/PROFITABILITY.md) | Burden rates, T&M, contracts, break even |
| [API](docs/API.md) | Conventions and a reference for each area |
| [API index](docs/API-INDEX.md) | Every route, generated from the source |
| [Webhooks](docs/WEBHOOKS.md) | Events, signing and verification |

Regenerate the API index after adding or changing a route:

```bash
node scripts/generate-api-index.mjs
```

## Modules

- **Dashboard** - KPIs, recent tickets, activity feed, revenue charts
- **CRM** - Companies, Contacts, Deals/Pipeline with drag-and-drop stages
- **Service Desk** - Ticket management with notes, status flow, time tracking
- **Contracts** - Managed services, block hours, retainer, ad-hoc, warranty types with SLA tracking
- **Quotes** - Quotation builder with line items, tax, auto-numbering (QUO-00001)
- **Invoices** - Invoice management with payments, recurring support, auto-numbering (INV-00001)
- **Projects** - Project management with tasks, milestones, budget tracking
- **Timesheets** - Time entry logging against tickets/projects, billable tracking
- **Reports** - Revenue, ticket, utilisation, and project reports
- **Settings** - General, Users, Roles (RBAC), Products/Services, Integrations

## Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Supabase Auth (`@supabase/ssr`) - email/password, reset, TOTP two-factor
- **Styling:** Tailwind CSS (dark theme)
- **Charts:** Recharts
- **Language:** TypeScript

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:

```
DATABASE_URL="postgresql://user:password@host:5432/psa_db"
DIRECT_DATABASE_URL="postgresql://user:password@host:5432/psa_db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"
```

### 3. Set up database

```bash
npx prisma generate
npx prisma db push
```

### 4. Run development server

```bash
npm run dev
```

### 5. Register first tenant

Navigate to `http://localhost:3000/register` to create your first tenant and admin account.

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add a PostgreSQL database (Vercel Postgres, Neon, or Supabase)
4. Set environment variables:
   - `DATABASE_URL` - pooled connection string
   - `DIRECT_DATABASE_URL` - direct connection string
   - `NEXTAUTH_URL` - your Vercel domain
   - `NEXTAUTH_SECRET` - generate with `openssl rand -base64 32`
5. Deploy

### Build command (Vercel)

```bash
npx prisma generate && next build
```

## Multi-Tenancy

- Every record is scoped to a `tenantId`
- API routes enforce tenant isolation automatically via `withTenant()` HOF
- Users can belong to multiple tenants
- Auto-incrementing numbers (tickets, quotes, invoices, contracts) are scoped per tenant

## Role-Based Access Control

Default roles: **Administrator**, **Manager**, **Technician**, **Sales**, **Finance**, **Viewer**

Permissions follow `module:action` format (e.g., `crm:create`, `invoices:export`).

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, Register
│   ├── (dashboard)/     # All protected module pages
│   └── api/             # API routes
├── components/
│   ├── layout/          # Sidebar, Header
│   └── ui/              # Reusable components
├── hooks/               # useApi
└── lib/                 # auth, prisma, utils, permissions, api helpers
```
