# Hosting VibePSA

One container image, three ways to run it.

| | Who | How |
|---|---|---|
| **Docker Compose** | Self-hosters | `docker compose up -d` — brings its own Postgres |
| **Railway** | The paid service | Deploys the Dockerfile, managed Postgres |
| **Render** | Alternative | `render.yaml`, same image |

The image is the unit of deployment everywhere, so what you test locally is what
runs in production.

---

## Why not serverless any more

VibePSA started on Vercel. It works, but a PSA wants things serverless makes
awkward:

- **Execution limits.** Report generation, bulk imports and long AI turns all
  fight a 10–60 second ceiling.
- **No background work.** Nothing can run between requests, so anything
  periodic needs an external scheduler.
- **Cold starts** on a low-traffic tenant make the first request of the morning
  feel broken.
- **Connection churn.** Every function instance wants a database connection,
  which is why the Vercel setup needed pgbouncer and `?pgbouncer=true`.

A persistent server removes all four. One process, a warm connection pool, and
the freedom to run work in-process.

---

## Self-hosting with Docker

```bash
git clone https://github.com/xantaradev/vibepsa.git
cd vibepsa
cp .env.docker.example .env
```

Edit `.env` — three things are required:

| | |
|---|---|
| `POSTGRES_PASSWORD` | Anything long |
| `AI_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| Supabase keys | A free project; only its auth service is used |

Then:

```bash
docker compose up -d
```

VibePSA is on http://localhost:3000. The schema is applied on start and demo
data seeded on first run (`RUN_SEED=false` to skip).

```bash
docker compose logs -f app     # watch it start
docker compose down            # stop
docker compose down -v         # stop and delete the database
```

Your data lives in the `vibepsa-db` volume. Back it up:

```bash
docker compose exec db pg_dump -U vibepsa vibepsa > backup.sql
```

> **Note on authentication.** Self-hosting still needs a Supabase project for
> sign-in, password reset and two-factor. Your business data never leaves your
> Postgres, but auth is not yet fully self-contained. Fixing that means adding a
> local auth provider — a known gap rather than a design decision.

---

## Railway

1. **New Project → Deploy from GitHub repo.** `railway.json` selects the
   Dockerfile automatically.
2. **Add a Postgres database** to the same project. Railway injects
   `DATABASE_URL`, and services talk over the private network.
3. **Set the environment variables** below.
4. **Generate a domain** under Settings → Networking, or attach your own.

```bash
DATABASE_URL=${{Postgres.DATABASE_URL}}
DIRECT_DATABASE_URL=${{Postgres.DATABASE_URL}}
AI_ENCRYPTION_KEY=<openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=https://app.vibepsa.net
DEPLOYMENT_MODE=hosted
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
RUN_SEED=false
```

`${{Postgres.DATABASE_URL}}` is Railway's reference syntax — it resolves to the
database in the same project, over the private network.

No pgbouncer parameters. One persistent process holds one pool, which is the
point of moving.

**Health checks** hit `/api/health`, which reports 503 when Postgres is
unreachable, so a broken deploy is caught rather than served.

### Then point Supabase at it

Authentication → URL Configuration:

- **Site URL:** `https://app.vibepsa.net`
- **Redirect URLs:** `https://app.vibepsa.net/auth/callback`,
  `https://app.vibepsa.net/auth/confirm`, and the localhost equivalents

Sign-in fails silently until those are set.

---

## Render

`render.yaml` is a blueprint: **New → Blueprint**, point at the repo, and it
creates the web service and database together. Fill in the `sync: false`
variables in the dashboard.

Render's free tier sleeps after inactivity, which reintroduces cold starts —
use Starter or above for anything real.

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `DIRECT_DATABASE_URL` | yes | Same value unless pooling |
| `AI_ENCRYPTION_KEY` | yes | 32-byte hex. **Changing it makes stored secrets undecryptable** |
| `NEXT_PUBLIC_APP_URL` | yes | Public URL. Microsoft webhooks need this reachable |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Auth. Secret — server only |
| `DEPLOYMENT_MODE` | no | `self_hosted` (default) or `hosted` |
| `AI_DATABASE_URL` | no | Restricted role for AI SQL. See [SECURITY-AI.md](SECURITY-AI.md) |
| `RUN_SEED` | no | Seed on start. `false` in production |
| `PORT` | no | Defaults to 3000 |

---

## Before charging anyone

**Adopt Prisma migrations.** The container currently starts with
`prisma db push --accept-data-loss`, which is fine for development and
**not fine for a paid service**: no history, no rollback, and it will drop a
column to match the schema without asking.

```bash
npx prisma migrate dev --name init      # once, locally
```

Then change `docker-entrypoint.sh` from `db push` to:

```sh
npx prisma migrate deploy
```

`migrate deploy` only applies committed migrations and never destroys data.

Also worth having before taking money: automated database backups (Railway and
Render both offer them, neither on by default), error tracking, and a staging
environment that is not production.

---

## Troubleshooting

**Container restart-loops on start**
Read `docker compose logs app`. Nearly always `DATABASE_URL` unreachable or the
schema sync failing — the entrypoint refuses to serve on a stale schema.

**`PrismaClientInitializationError: Query engine not found`**
Rebuild without cache: `docker compose build --no-cache app`. The engine is
copied explicitly in the final stage and a stale layer can miss it.

**Health check fails but the app looks fine**
`/api/health` runs a real `SELECT 1`. If it 503s, the app cannot reach Postgres
even if pages render from cache.

**Emails stop after moving host**
`AI_ENCRYPTION_KEY` differs from the one that encrypted the stored SMTP
password. Set it to match the old value, or re-enter the password.

**Microsoft email stops after moving host**
The webhook URL changed. Settings → Email → **Connect Mailbox** to
re-subscribe against the new domain.
