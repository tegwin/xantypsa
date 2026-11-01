# Contributing to Xanty PSA

Xanty PSA is built in the open by an MSP consultancy. The most valuable thing you
can bring is not necessarily code — it is knowing how MSPs actually work.

## The most useful contribution

**Tell us where it's wrong.** If a workflow here doesn't match how your business
runs, that's a bug even if nothing crashes. An issue that says "our contracts
renew on the anniversary of go-live, not the calendar year, and Xanty PSA can't
express that" is worth more than a typo fix.

Open an issue describing what you do today and what Xanty PSA made you do instead.

## Getting set up

You need Node 18+ and a PostgreSQL database.

```bash
git clone https://github.com/xantaradev/vibepsa.git
cd xantypsa
npm install
cp .env.example .env      # set DATABASE_URL at minimum
npx prisma db push
npm run db:seed
npm run dev
```

## Before you open a pull request

```bash
npx tsc --noEmit    # types
npm run build       # catches things tsc does not
```

`npm run build` matters. Several classes of failure — exporting non-route values
from route files, `useSearchParams` without a Suspense boundary, server-only
modules pulled into client bundles — pass type checking and fail the build.

## House style

- Match the surrounding file. Consistency beats any rule here.
- Small, readable functions over clever one-liners.
- Comment the *why*, not the *what*, and only where it isn't obvious.
- Names, not IDs, in the interface. A dropdown shows "Acme Ltd", never `cm9x…`.
- Money is stored net, before tax. If you add a total, say which it is.

## Things that need care

**Multi-tenancy.** Every query must be scoped by `tenantId`. Apply the tenant
filter *after* any caller-supplied `where` clause so it cannot be overridden.

**Cost and profitability.** Cost is snapshotted onto the record when work is
logged, never looked up later. Changing an engineer's rate must not rewrite last
quarter's reported margin.

**The AI SQL tool.** Read [docs/SECURITY-AI.md](docs/SECURITY-AI.md) first. If you
add a model to the schema, re-run `node scripts/generate-rls.mjs` so it gets a
row-level security policy — the generator exists precisely so a new table cannot
ship without one.

**Database changes.** Update `prisma/schema.prisma`, regenerate the RLS policies,
and keep `sql/schema.sql` in step so a fresh install still works.

## Licence

Xanty PSA is [AGPL-3.0](LICENSE). By contributing you agree your work is released
under the same licence. There is no CLA and no copyright assignment — your
commits stay yours.
