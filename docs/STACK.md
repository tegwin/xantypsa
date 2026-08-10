# The VibePSA stack

What this is built in, and why each piece is there.

Two separate applications:

| | What | Where |
|---|---|---|
| **The app** | VibePSA itself | `vibepsa/` |
| **The site** | The marketing page for vibepsa.com | `vibepsa-site/` |

---

## At a glance

**Language**
- TypeScript 5.4
- Target ES2017, `strict: false`

**Framework**
- Next.js 14.2 — App Router
- React 18.3 — server components by default, `'use client'` where interactive

**Database**
- PostgreSQL
- Prisma 5.14 as the ORM and schema source of truth
- 59 models, 1,486 lines of schema

**Authentication**
- Supabase Auth via `@supabase/ssr` 0.12 — staff logins
- TOTP two-factor, enforced per user
- Signed-cookie sessions for admin impersonation and the client portal

**Styling**
- Tailwind CSS 3.4, `darkMode: 'class'`
- Custom `brand` (blue, `#1e6af5`) and `surface` (slate) palettes
- Geist Sans and Geist Mono
- Lucide for icons

**AI**
- `@anthropic-ai/sdk` and `openai` behind one provider-neutral adapter
- `@modelcontextprotocol/sdk` for the MCP server

**Hosting**
- Vercel (serverless)
- Supabase for Postgres

---

## Size

| | |
|---|---|
| TypeScript / TSX files | 263 |
| Lines in `src/` | ~33,200 |
| API routes | 105 |
| Pages | 71 |
| Database models | 59 |

---

## Why each choice

### Next.js 14 App Router

One deployable serving the UI, the API and the webhook receivers. Server
components mean most pages query Postgres directly with no API round trip, and
the API routes exist for the things that genuinely need to be called — the
browser, Microsoft Graph, the MCP server.

The cost is that Vercel functions are stateless and time-limited, which is why
there is no background worker and why incoming email is webhook-driven rather
than polled.

### Prisma over raw SQL

The schema file is the single definition of the data model, and it is read at
runtime in two places:

- `src/lib/ai/schema-context.ts` parses it so the AI knows the real field names
  instead of guessing.
- `scripts/generate-rls.mjs` generates row-level security policies from it, so
  a new model cannot ship without one.

`sql/schema.sql` is the full DDL for anyone who would rather not run Prisma.

### Supabase Auth rather than rolling our own

Password hashing, reset flows, email verification and TOTP are all solved
problems with unpleasant failure modes. This started on NextAuth and moved to
Supabase Auth for the hosted flows and assurance levels.

Clients are deliberately **not** Supabase users. A portal user is a `Contact`
with a signed session cookie, so a client login can never resolve to a staff
session.

### TypeScript with `strict: false`

An honest compromise. The codebase grew fast and `strict` would mean a large
retrofit. It is a known debt: `tsc --noEmit` catches real errors, but null
safety is not enforced.

**`npm run build` catches things `tsc` does not** — server-only imports leaking
into client bundles, `useSearchParams` without Suspense, non-route exports from
route files. Always run it before shipping.

---

## Layout

```
src/
├── app/
│   ├── (auth)/         sign in, register, reset, 2FA setup and challenge
│   ├── (dashboard)/    the staff application
│   ├── portal/         the client portal — separate auth, separate layout
│   └── api/            105 route handlers
├── components/
│   ├── layout/         sidebar, header
│   ├── ui/             shared primitives
│   └── ai/             the assistant panel
├── hooks/              useApi and friends
├── lib/                the domain logic
└── mcp/                MCP server (stdio, for Claude Desktop)
```

### The interesting parts of `lib/`

| Module | What it holds |
|---|---|
| `costing.ts` | Cost and profitability. Rates are per tenant *and* per engineer, snapshotted at write time so changing a rate never rewrites past margin. |
| `billing.ts`, `contract-billing.ts` | Contract values are always NET. A contract is never billed directly — the recurring invoice against it is the billing mechanism. |
| `emailRouting.ts` | Incoming mail → the right client: contact email, then company domain, then website domain, then catch-all. |
| `graphSubscription.ts` | Microsoft Graph mail subscriptions and their event-driven renewal. |
| `crypto.ts` | AES-256-GCM for stored secrets — LLM keys and SMTP passwords. |
| `portal/` | Client portal: slug rules, magic-link tokens, signed session. |
| `ai/` | Provider adapters, schema context, the tool surface, RLS-scoped SQL. |
| `permissions.ts` | Role-based access control. |

---

## Integrations

| | How |
|---|---|
| **Microsoft 365** | Graph webhook. Mail is pushed on arrival and becomes a ticket — no polling, no cron. Subscriptions renew on Graph lifecycle events and on incoming mail. |
| **SMTP** | Nodemailer for outbound. Passwords encrypted at rest. |
| **LLMs** | Anthropic, OpenAI, or anything OpenAI-compatible including local Ollama. Bring your own key. |
| **MCP** | `npm run mcp` exposes VibePSA to Claude Desktop over stdio, sharing the in-app assistant's tools. |

---

## Security

- **Multi-tenancy** — every query scoped by `tenantId`, applied *after* any
  caller-supplied `where` so it cannot be overridden.
- **Row-level security** — the AI's SQL tool runs as `vibepsa_ai`, a SELECT-only
  Postgres role with RLS on all tables. Auth tables are unreadable to it. With
  no tenant set it sees nothing — it fails closed. See
  [SECURITY-AI.md](SECURITY-AI.md).
- **Secrets at rest** — AES-256-GCM, keyed by `AI_ENCRYPTION_KEY`.
- **Signed cookies** — HMAC-SHA256 with constant-time comparison, for
  impersonation and portal sessions.
- **Webhook authentication** — Graph notifications verified against a random
  per-subscription secret; the resource path is constrained.
- **Two-factor** — TOTP via Supabase, enforceable per user.

---

## Tooling

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run build:check` | Build into `.next-verify` — safe to run while `dev` is up |
| `npm run db:push` | Apply the schema |
| `npm run db:seed` | Seed data |
| `npm run mcp` | MCP server |
| `node scripts/generate-rls.mjs` | Regenerate RLS policies from the schema |

`build:check` exists because `next dev` and `next build` both write to `.next`
and corrupt each other's chunks. Use it for verification while developing.

---

## The marketing site

Deliberately minimal — a static page has no reason to carry a database client.

- Next.js 14, React 18, Tailwind
- `lucide-react`, `geist`
- No database, no auth, no environment variables
- Builds fully static, ~89 kB first load
- Brand tokens copied from the app so the two look like one product

---

## Requirements

- **Node 18+** (developed on 25.6, npm 11.9)
- **PostgreSQL** — Supabase, Neon, RDS, or your own
- A Supabase project for authentication

Optional: an LLM API key for the assistant, SMTP or Microsoft 365 for email.

---

## Known debt

- **`strict: false`** — null safety is not enforced.
- **`emailProcessor.ts`** — the old polling path. Nothing calls it any more, but
  `getAccessToken` is still used by the subscription code, so the file remains.
- **RLS covers the AI SQL tool only** — the rest of the app scopes tenants in
  application code, not at the database level.
- **`sql/schema.sql` does not include RLS** — `ai-role.sql` and `rls.sql` are run
  separately.
