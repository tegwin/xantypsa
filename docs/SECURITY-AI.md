# Keeping the AI inside one tenant

The AI can write SQL. That is what makes it useful for questions structured
filters can't answer ("tickets opened and closed the same day"), and it is also
the biggest risk in the product: a query that forgets its tenant predicate is a
cross-tenant data leak.

There are two controls, and only the second one is a real boundary.

## 1. Query validation (`assertSafeSelect`)

Before any model-authored SQL runs it must be a single `SELECT`/`WITH`, contain
no DML or DDL keywords, filter on `$1` rather than an inlined tenant id, and
carry a row cap.

This catches mistakes and casual misuse. It is string matching, so it is **not**
something to rely on by itself - a sufficiently creative query could get past it.

## 2. The database (the actual boundary)

Analytics queries run on a separate PostgreSQL role, `xantypsa_ai`, which:

- has `SELECT` and nothing else - `INSERT`, `UPDATE`, `DELETE` and `TRUNCATE`
  are revoked
- cannot read `users`, `accounts`, `sessions` or `verification_tokens` at all
- sees only rows belonging to the current tenant, enforced by row-level security

The tenant is set per transaction with
`set_config('app.tenant_id', $1, true)` - parameterised, never string-concatenated,
and scoped to the transaction so a pooled connection can't carry one tenant's
id into the next query.

With no tenant set, every policy evaluates false and the role sees **nothing**.
It fails closed.

Xanty PSA's own connection is unaffected: it owns these tables and holds
`rolbypassrls`, so the application behaves exactly as it did before.

## Setting it up

```bash
node scripts/generate-rls.mjs     # regenerates sql/rls.sql + sql/ai-role.sql
```

1. Edit `sql/ai-role.sql`, replacing `CHANGE_ME` with a generated password
   (`openssl rand -base64 24`)
2. Run `sql/ai-role.sql`, then `sql/rls.sql`
3. Put the matching connection string in `AI_DATABASE_URL`

Use a **direct** connection (port 5432), not the transaction pooler - the tenant
is set with a transaction-local setting, and transaction-mode pooling can move
the query to a different session.

**Re-run the generator after any schema change.** The policies are generated from
`prisma/schema.prisma` precisely so that a newly added model cannot quietly ship
without one. The generator reports any model it could not tie to a tenant; those
are denied rather than left open.

## If `AI_DATABASE_URL` is not set

The SQL tool falls back to the application's own connection and logs a warning
at startup. Validation still applies, but the database-level boundary does not - 
tenant isolation then rests on `assertSafeSelect` alone. Don't run that way
against real customer data.

## What is not covered

`query_records` and `create_record` go through Prisma on the application
connection, not the restricted role. They are scoped in code: the tenant filter
is applied *after* any model-supplied `where` clause, so it cannot be overridden.
That's a narrower surface than free-form SQL - the model chooses filters, not the
query - but it is application-level scoping, not database-level.
