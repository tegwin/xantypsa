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

Edit `.env` — **two** things are required:

| | |
|---|---|
| `POSTGRES_PASSWORD` | Anything long |
| `AI_ENCRYPTION_KEY` | `openssl rand -hex 32` |

That is the whole list. There is no third-party service to sign up for.

Then:

```bash
docker compose up -d
```

VibePSA is on http://localhost:3000. The schema is applied on start and demo
data seeded on first run (`RUN_SEED=false` to skip).

The first-run administrator password is generated and printed once:

```bash
docker compose logs app | grep -A3 "Ready to sign in"
```

Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` to choose your own.

```bash
docker compose logs -f app     # watch it start
docker compose down            # stop
docker compose down -v         # stop and delete the database
```

Your data lives in the `vibepsa-db` volume. Back it up:

```bash
docker compose exec db pg_dump -U vibepsa vibepsa > backup.sql
```

> **Authentication is built in.** Passwords are bcrypt hashes in your own
> database, sessions are signed cookies, and two-factor is RFC 6238 TOTP
> implemented on node:crypto. Nothing calls out to anyone. Password reset is the
> only feature needing configuration — it emails a link, so it wants SMTP under
> Settings → Email.

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
# Same value. Railway gives you one URL, but prisma/schema.prisma declares a
# directUrl, and Prisma refuses to start if a referenced variable is absent —
# so this must be set even though it points at the same database.
DIRECT_DATABASE_URL=${{Postgres.DATABASE_URL}}
AI_ENCRYPTION_KEY=<openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=https://app.vibepsa.net
DEPLOYMENT_MODE=hosted
RUN_SEED=true
SEED_ADMIN_EMAIL=you@yourcompany.com
```

Seven variables, three of which you already know. Once you have signed in and
changed the password, set `RUN_SEED=false` and redeploy.

`${{Postgres.DATABASE_URL}}` is Railway's reference syntax — it resolves to the
database in the same project, over the private network.

No pgbouncer parameters. One persistent process holds one pool, which is the
point of moving.

**Health checks** hit `/api/health`, which reports 503 when Postgres is
unreachable, so a broken deploy is caught rather than served.

**Do not hard-code the port anywhere.** Railway assigns one and injects `PORT`;
the Next standalone server reads it, and so does the container's own health
probe. A probe pinned to 3000 reports unhealthy for ever while the app serves
perfectly well, and the deploy fails at the networking step with
*"Deployment failed during the network process"* — which reads like a platform
fault rather than a health check looking at the wrong door.

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
| `SEED_ADMIN_EMAIL` | no | First-run administrator. Defaults to admin@admin.com |
| `SEED_ADMIN_PASSWORD` | no | Generated and logged once if unset |
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

**"Deployment failed during the network process" (Railway)**
The build succeeded and the app never became reachable. Either it is not
listening on the injected `PORT`, or the health check is. Check the deploy logs
for `starting on port` and compare it with the `PORT` variable.

**`Environment variable not found: DIRECT_DATABASE_URL`**
Set it to the same value as `DATABASE_URL`. Prisma validates every variable the
schema mentions, whether or not the connection needs a second one.

**Container restart-loops on start**
Read `docker compose logs app`. Nearly always `DATABASE_URL` unreachable or the
schema sync failing — the entrypoint refuses to serve on a stale schema.

**`PrismaClientInitializationError: Query engine not found`**
Rebuild without cache: `docker compose build --no-cache app`. The engine is
copied explicitly in the final stage and a stale layer can miss it.

**Health check fails but the app looks fine**
`/api/health` runs a real `SELECT 1`. If it 503s, the app cannot reach Postgres
even if pages render from cache.

**Everyone is signed out after a redeploy**
`AI_ENCRYPTION_KEY` changed. It signs session cookies, so a new value
invalidates every session — and makes enrolled TOTP secrets unreadable. Set it
once and keep it.

**Emails stop after moving host**
`AI_ENCRYPTION_KEY` differs from the one that encrypted the stored SMTP
password. Set it to match the old value, or re-enter the password.

**Microsoft email stops after moving host**
The webhook URL changed. Settings → Email → **Connect Mailbox** to
re-subscribe against the new domain.
