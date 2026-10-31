#!/bin/sh
# ============================================================
# Container start-up
# ============================================================
# Bring the database schema up to date before serving. Self-hosters should not
# have to run a migration step by hand, and a platform redeploy should leave the
# schema correct without human intervention.

set -e

# ---- Pre-flight ------------------------------------------------------
# Fail with a sentence someone can act on, rather than letting Prisma or the
# Next server produce a stack trace that hides which variable is missing.

if [ -z "$DATABASE_URL" ]; then
  echo "[xantypsa] DATABASE_URL is not set — cannot start." >&2
  echo "[xantypsa]" >&2
  echo "[xantypsa] Set it on THIS service, not on the database service." >&2
  echo "[xantypsa] On Railway the value references your Postgres service by its" >&2
  echo "[xantypsa] own name, so if that service is called xantypsa-db it reads:" >&2
  echo "[xantypsa]   DATABASE_URL=\${{xantypsa-db.DATABASE_URL}}" >&2
  echo "[xantypsa] Easiest: Variables -> New Variable -> Add Reference, and pick" >&2
  echo "[xantypsa] DATABASE_URL from the list — Railway fills in the right name." >&2
  exit 1
fi

# prisma/schema.prisma declares a directUrl, and Prisma refuses to start when a
# variable it references is absent — even though most platforms hand out only
# one connection string. Default it rather than making everyone discover this.
if [ -z "$DIRECT_DATABASE_URL" ]; then
  echo "[xantypsa] DIRECT_DATABASE_URL not set — using DATABASE_URL."
  export DIRECT_DATABASE_URL="$DATABASE_URL"
fi

if [ -z "$AI_ENCRYPTION_KEY" ]; then
  echo "[xantypsa] AI_ENCRYPTION_KEY is not set — cannot start." >&2
  echo "[xantypsa] It signs session cookies and encrypts stored secrets." >&2
  echo "[xantypsa] Generate one with: openssl rand -hex 32" >&2
  echo "[xantypsa] Refusing to start rather than serving an app nobody can sign in to." >&2
  exit 1
fi

echo "[xantypsa] port=${PORT:-3000}  mode=${DEPLOYMENT_MODE:-self_hosted}  seed=${RUN_SEED:-false}"

if [ -n "$DATABASE_URL" ]; then
  echo "[xantypsa] syncing database schema…"
  # Invoked directly rather than through npx: the standalone runtime image has
  # node_modules/prisma but not the node_modules/.bin symlinks npx resolves
  # through, so `npx prisma` is "not found" in the container.
  #
  # `db push` because this project has no migration history yet. See
  # docs/HOSTING.md — adopt `prisma migrate` before running a paid service.
  node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss || {
    echo "[xantypsa] schema sync failed — refusing to start with a stale schema" >&2
    exit 1
  }

  if [ "$RUN_SEED" = "true" ]; then
    echo "[xantypsa] seeding…"
    # Seeding is idempotent, so a failure here is a real fault — not "already
    # done". Say so loudly rather than starting a XantyPSA nobody can sign in to.
    if ! node prisma/seed.js; then
      echo "[xantypsa] SEED FAILED — see the error above." >&2
      echo "[xantypsa] The app will start, but there may be no account to sign in with." >&2
    fi
  fi
fi

echo "[xantypsa] starting on port ${PORT:-3000}"
exec "$@"
