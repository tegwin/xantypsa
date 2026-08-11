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
  echo "[vibepsa] DATABASE_URL is not set — cannot start." >&2
  echo "[vibepsa] On Railway: add a Postgres service and set" >&2
  echo "[vibepsa]   DATABASE_URL=\${{Postgres.DATABASE_URL}}" >&2
  exit 1
fi

# prisma/schema.prisma declares a directUrl, and Prisma refuses to start when a
# variable it references is absent — even though most platforms hand out only
# one connection string. Default it rather than making everyone discover this.
if [ -z "$DIRECT_DATABASE_URL" ]; then
  echo "[vibepsa] DIRECT_DATABASE_URL not set — using DATABASE_URL."
  export DIRECT_DATABASE_URL="$DATABASE_URL"
fi

if [ -z "$AI_ENCRYPTION_KEY" ]; then
  echo "[vibepsa] AI_ENCRYPTION_KEY is not set — cannot start." >&2
  echo "[vibepsa] It signs session cookies and encrypts stored secrets." >&2
  echo "[vibepsa] Generate one with: openssl rand -hex 32" >&2
  echo "[vibepsa] Refusing to start rather than serving an app nobody can sign in to." >&2
  exit 1
fi

echo "[vibepsa] port=${PORT:-3000}  mode=${DEPLOYMENT_MODE:-self_hosted}  seed=${RUN_SEED:-false}"

if [ -n "$DATABASE_URL" ]; then
  echo "[vibepsa] syncing database schema…"
  # Invoked directly rather than through npx: the standalone runtime image has
  # node_modules/prisma but not the node_modules/.bin symlinks npx resolves
  # through, so `npx prisma` is "not found" in the container.
  #
  # `db push` because this project has no migration history yet. See
  # docs/HOSTING.md — adopt `prisma migrate` before running a paid service.
  node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss || {
    echo "[vibepsa] schema sync failed — refusing to start with a stale schema" >&2
    exit 1
  }

  if [ "$RUN_SEED" = "true" ]; then
    echo "[vibepsa] seeding…"
    # Seeding is idempotent, so a failure here is a real fault — not "already
    # done". Say so loudly rather than starting a VibePSA nobody can sign in to.
    if ! node prisma/seed.js; then
      echo "[vibepsa] SEED FAILED — see the error above." >&2
      echo "[vibepsa] The app will start, but there may be no account to sign in with." >&2
    fi
  fi
fi

echo "[vibepsa] starting on port ${PORT:-3000}"
exec "$@"
