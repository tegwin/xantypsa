// ============================================================
// The connection the AI's SQL tool reads through
// ============================================================
// Model-authored SQL is validated before it runs (assertSafeSelect), but string
// validation is not a security boundary - a clever query could still slip past
// it. The durable control is the database itself: a role with SELECT only, and
// row-level security that filters every table to one tenant.
//
// Set AI_DATABASE_URL to a connection string for the xantypsa_ai role after
// running sql/ai-role.sql and sql/rls.sql. Use a direct connection (port 5432),
// not the transaction pooler - the tenant is set with set_config(..., local)
// inside a transaction, and pooling in transaction mode can move the query to a
// different session.

import { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

let restrictedClient: PrismaClient | null = null;
let warned = false;

/** Cuid/uuid shaped. Guards the value we hand to set_config. */
const TENANT_ID = /^[A-Za-z0-9_-]{1,64}$/;

function getClient(): { db: PrismaClient; restricted: boolean } {
  const url = process.env.AI_DATABASE_URL;

  if (!url) {
    if (!warned) {
      warned = true;
      console.warn(
        '[ai] AI_DATABASE_URL is not set - analytics queries run on the ' +
          'application connection, so tenant isolation rests on query ' +
          'validation alone. See sql/ai-role.sql to close this.'
      );
    }
    return { db: prisma, restricted: false };
  }

  if (!restrictedClient) {
    restrictedClient = new PrismaClient({
      datasources: { db: { url } },
      log: ['warn', 'error'],
    });
  }
  return { db: restrictedClient, restricted: true };
}

/**
 * Run a validated SELECT with the tenant pinned for the life of the query.
 *
 * The tenant reaches Postgres two ways: as $1 for the query's own predicate,
 * and via set_config for the RLS policies. Both are parameterised - no tenant
 * id is ever concatenated into SQL.
 */
export async function runTenantScopedQuery(
  sql: string,
  tenantId: string
): Promise<{ rows: unknown[]; restricted: boolean }> {
  if (!TENANT_ID.test(tenantId)) {
    throw new Error('Refusing to run a query for a malformed tenant id');
  }

  const { db, restricted } = getClient();

  const rows = await db.$transaction(async (tx) => {
    // `true` scopes the setting to this transaction, so a pooled connection
    // cannot carry one tenant's id into the next query.
    await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return tx.$queryRawUnsafe(sql, tenantId);
  });

  return { rows: rows as unknown[], restricted };
}
