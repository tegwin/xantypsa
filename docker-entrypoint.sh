#!/bin/sh
# ============================================================
# Container start-up
# ============================================================
# Bring the database schema up to date before serving. Self-hosters should not
# have to run a migration step by hand, and a platform redeploy should leave the
# schema correct without human intervention.

set -e

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
else
  echo "[vibepsa] DATABASE_URL is not set — cannot start" >&2
  exit 1
fi

echo "[vibepsa] starting on port ${PORT:-3000}"
exec "$@"
