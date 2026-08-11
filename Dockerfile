# ============================================================
# VibePSA container image
# ============================================================
# Multi-stage so the runtime image carries only what it needs to serve: the
# standalone Next server, static assets, and the Prisma client with its query
# engine. Build tooling and dev dependencies stay behind.
#
# Debian slim rather than Alpine: Prisma's query engine needs glibc and OpenSSL,
# and the musl builds are a recurring source of "engine not found" at runtime
# for a saving that does not matter here.

# ---------- dependencies ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# openssl is required by the Prisma engine, ca-certificates for outbound TLS
# (Microsoft Graph, LLM providers, SMTP).
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `npm ci` runs postinstall, which generates the Prisma client.
RUN npm ci

# ---------- build ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time placeholders. Next evaluates NEXT_PUBLIC_* at build, and the real
# values are injected at run time by the platform — but the build must not fail
# for want of a database it will never contact.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DIRECT_DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN npx prisma generate
RUN npm run build

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# A default only. Railway, Render and Fly all inject their own PORT, and the
# Next standalone server reads it — do not assume 3000 anywhere at runtime.
ENV PORT=3000
# Bind all interfaces, or the platform's proxy cannot reach the container.
ENV HOSTNAME=0.0.0.0

# Never run the server as root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The schema and generated client are needed at run time: `prisma db push` on
# start, and the engine the client loads. Standalone tracing does not reliably
# pick up the engine binary, so copy it explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
# prisma/seed.js is a plain Node script, outside Next's dependency tracing, so
# its imports have to be present as real modules rather than bundled.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/sql ./sql
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# The platform health-checks /api/health; this is the container's own view.
#
# The port is read at runtime, never hard-coded: Railway (and Render, and Fly)
# assign a port and inject PORT, so a probe pinned to 3000 can never succeed
# there. The container then reports unhealthy for ever and the deploy is failed
# at the networking step, even though the app is serving perfectly well.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
