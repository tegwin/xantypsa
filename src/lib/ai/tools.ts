// ============================================================
// The XantyPSA tool surface
// ============================================================
// Defined once and consumed twice: by the in-app AI panel and by the MCP
// server. Adding a capability here exposes it to both, so they cannot drift.

import { prisma } from '@/lib/prisma';
import { buildSchemaIndex, describeModel, getModel, listModels } from './schema-context';
import { runTenantScopedQuery } from './readonly-db';
import { assignReference } from '@/lib/numbering';
import type { ToolDefinition } from './providers/types';

export interface ToolContext {
  tenantId: string;
  userId: string;
  /** When false, mutating tools are withheld entirely. */
  allowWrites: boolean;
}

// ------------------------------------------------------------
// Read-only SQL guardrails
// ------------------------------------------------------------

const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|COPY|VACUUM|REINDEX|CALL|DO|SET|MERGE)\b/i;
const MAX_ROWS = 500;

export class UnsafeQueryError extends Error {}

/**
 * Validate a model-authored SQL string before it reaches the database.
 *
 * Defence in depth, because a mistake here is cross-tenant data exposure:
 *   1. SELECT/WITH only, single statement
 *   2. No DML/DDL keywords anywhere
 *   3. The tenant predicate must be present and bound to $1 (never inlined,
 *      so the model cannot choose which tenant it reads)
 *   4. A row cap is always applied
 *
 * This is validation, not the security boundary. The boundary is the database:
 * queries run through runTenantScopedQuery on a SELECT-only role, with RLS
 * filtering every table to one tenant. See sql/ai-role.sql and sql/rls.sql.
 */
export function assertSafeSelect(sql: string): string {
  const trimmed = sql.trim().replace(/;\s*$/, '');

  if (trimmed.includes(';')) {
    throw new UnsafeQueryError('Only a single statement is allowed');
  }
  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    throw new UnsafeQueryError('Only SELECT queries are allowed');
  }
  if (FORBIDDEN.test(trimmed)) {
    throw new UnsafeQueryError('Query contains a forbidden keyword');
  }
  if (!trimmed.includes('$1')) {
    throw new UnsafeQueryError(
      'Query must filter by tenant using the $1 parameter, e.g. "tenantId" = $1'
    );
  }
  if (/\btenantId\b\s*=\s*'/i.test(trimmed)) {
    throw new UnsafeQueryError('Do not inline a tenant id; always use $1');
  }

  return /\bLIMIT\b/i.test(trimmed) ? trimmed : `${trimmed} LIMIT ${MAX_ROWS}`;
}

// ------------------------------------------------------------
// Tool definitions
// ------------------------------------------------------------

const READ_TOOLS: ToolDefinition[] = [
  {
    name: 'describe_schema',
    description:
      'Get the full field list, types and allowed values for a model. Call this before building a query if you are unsure of a field name. Pass no argument to list every model.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model name, e.g. Ticket, Company, Invoice' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'query_records',
    description:
      'Read records with structured filters. Use this for straightforward lookups ("open tickets for Acme"). For anything needing aggregation, date maths, or comparing two columns, use run_analytics_query instead.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model name, e.g. Ticket' },
        where: { type: 'object', description: 'Prisma where clause. tenantId is added automatically.' },
        include: { type: 'object', description: 'Prisma include clause for relations.' },
        orderBy: { type: 'object', description: 'Prisma orderBy clause.' },
        take: { type: 'integer', description: `Max rows (default 50, cap ${MAX_ROWS}).` },
      },
      required: ['model'],
      additionalProperties: false,
    },
  },
  {
    name: 'run_analytics_query',
    description:
      'Run a read-only SQL SELECT against the PostgreSQL database. Use for aggregates, date arithmetic, and conditions comparing two columns (e.g. tickets opened and closed on the same day). Use the SQL table names from describe_schema, quote camelCase identifiers, and you MUST filter by tenant with "tenantId" = $1.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'A single SELECT statement using $1 for the tenant id.',
        },
        explanation: {
          type: 'string',
          description: 'One sentence on what this query answers, shown to the user.',
        },
      },
      required: ['sql'],
      additionalProperties: false,
    },
  },
];

const WRITE_TOOLS: ToolDefinition[] = [
  {
    name: 'create_record',
    description:
      'Create a record. Call describe_schema first to confirm required fields. tenantId is set automatically. Always summarise what you are about to create and confirm with the user before calling this.',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Model name, e.g. Opportunity' },
        data: { type: 'object', description: 'Field values for the new record.' },
      },
      required: ['model', 'data'],
      additionalProperties: false,
    },
  },
];

export function getToolDefinitions(ctx: ToolContext): ToolDefinition[] {
  return ctx.allowWrites ? [...READ_TOOLS, ...WRITE_TOOLS] : READ_TOOLS;
}

// ------------------------------------------------------------
// Execution
// ------------------------------------------------------------

function prismaDelegate(modelName: string) {
  const model = getModel(modelName);
  if (!model) throw new Error(`Unknown model "${modelName}"`);
  const key = model.name.charAt(0).toLowerCase() + model.name.slice(1);
  const delegate = (prisma as any)[key];
  if (!delegate) throw new Error(`Model "${model.name}" is not queryable`);
  return { delegate, model };
}

export async function executeTool(
  name: string,
  input: Record<string, any>,
  ctx: ToolContext
): Promise<{ content: string; isError?: boolean }> {
  try {
    switch (name) {
      case 'describe_schema': {
        if (!input.model) {
          return { content: listModels().map((m) => `${m.name} (${m.tableName})`).join('\n') };
        }
        return { content: describeModel(input.model) };
      }

      case 'query_records': {
        const { delegate } = prismaDelegate(input.model);
        const take = Math.min(input.take ?? 50, MAX_ROWS);
        const rows = await delegate.findMany({
          // Tenant scoping is applied last so a model-supplied where clause
          // cannot override it.
          where: { ...(input.where ?? {}), tenantId: ctx.tenantId },
          ...(input.include ? { include: input.include } : {}),
          ...(input.orderBy ? { orderBy: input.orderBy } : {}),
          take,
        });
        return { content: JSON.stringify({ count: rows.length, rows }, null, 2) };
      }

      case 'run_analytics_query': {
        const sql = assertSafeSelect(input.sql);
        const { rows } = await runTenantScopedQuery(sql, ctx.tenantId);
        return { content: JSON.stringify({ rowCount: rows.length, rows }, null, 2) };
      }

      case 'create_record': {
        if (!ctx.allowWrites) {
          return { content: 'Writes are not permitted in this context.', isError: true };
        }
        const { delegate, model } = prismaDelegate(input.model);
        const hasCreatedBy = model.fields.some((f) => f.name === 'createdById');

        // Tickets, quotes, invoices and contracts carry a human-facing
        // reference that the API routes generate. Creating one straight through
        // Prisma would leave it blank, so assign it the same way here.
        const reference = await assignReference(model.name, ctx.tenantId, input.data ?? {});

        const created = await delegate.create({
          data: {
            ...input.data,
            ...reference,
            tenantId: ctx.tenantId,
            ...(hasCreatedBy ? { createdById: ctx.userId } : {}),
          },
        });
        return { content: JSON.stringify({ created }, null, 2) };
      }

      default:
        return { content: `Unknown tool "${name}"`, isError: true };
    }
  } catch (err: any) {
    // Errors go back to the model as tool results so it can correct itself
    // rather than the whole turn failing.
    return { content: `Error: ${err?.message ?? String(err)}`, isError: true };
  }
}

// ------------------------------------------------------------
// System prompt
// ------------------------------------------------------------

export function buildSystemPrompt(module?: string): string {
  return `You are the AI assistant built into XantyPSA, a multi-tenant Professional Services Automation platform for MSPs. You help with tickets, companies, contacts, contracts, quotes, invoices, projects, time entries and reporting.

${module ? `The user is currently on the ${module} screen, so assume that context unless they say otherwise.\n` : ''}
## How the system is structured

Every record belongs to a tenant, and tenant filtering is applied automatically — never ask the user for a tenant id.

Below is the index of every model and its fields. Call describe_schema for full types and allowed values before writing a query against a model you have not used yet.

${buildSchemaIndex()}

## Domain rules that are not obvious from the schema

- A contract is never billed directly. It absorbs labour and defines a price; the recurring invoice raised against it is the billing mechanism.
- A contract's \`value\` is always NET, before tax.
- Time entries with chargeType 'contract' are covered by that contract and are not separately billable.
- An invoice with isRecurring = true and a nextRecurring date is a billing schedule; the invoices it emits have isRecurring = false.

## Choosing a tool

- Simple filtered lookups → query_records.
- Aggregates, date arithmetic, or comparing two columns to each other → run_analytics_query. For example "tickets opened and closed on the same day" is DATE("createdAt") = DATE("closedAt"), which structured filters cannot express.
- SQL identifiers are camelCase and must be double-quoted. Always include "tenantId" = $1.

## Behaviour

Answer with the result, not a description of how you got it. When a query returns rows, summarise the finding first and show the detail after.

Before creating or changing anything, state plainly what you are about to do and wait for the user to confirm. Never invent field values — if a required field is missing, ask.`;
}
