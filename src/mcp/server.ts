// ============================================================
// VibePSA MCP server
// ============================================================
// Exposes VibePSA to Claude Desktop (or any MCP client) over stdio.
//
// The tools are the same ones the in-app AI panel uses — imported from
// lib/ai/tools rather than redefined — so the two surfaces cannot drift apart.
// query_records and create_record work against any model in the schema, so
// "all endpoints" is covered by four general tools rather than two hundred
// hand-written ones.
//
// Run it with:  npm run mcp
// See docs/MCP.md for the Claude Desktop configuration.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { prisma } from '@/lib/prisma';
import {
  executeTool,
  getToolDefinitions,
  buildSystemPrompt,
  type ToolContext,
} from '@/lib/ai/tools';

// ------------------------------------------------------------
// Who this server acts as
// ------------------------------------------------------------
// A tenant and a user, resolved once at startup. Everything the client asks for
// is scoped to them — the MCP client never chooses a tenant, so a prompt cannot
// talk the server into reading someone else's data.

async function resolveIdentity() {
  const wantTenant = process.env.MCP_TENANT?.trim();
  const wantUser = process.env.MCP_USER_EMAIL?.trim();

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (tenants.length === 0) {
    throw new Error('No tenants exist in this database.');
  }

  let tenant;
  if (wantTenant) {
    tenant =
      tenants.find((t) => t.id === wantTenant) ??
      tenants.find((t) => t.name.toLowerCase() === wantTenant.toLowerCase());
    if (!tenant) {
      throw new Error(
        `No tenant matching "${wantTenant}". Available: ${tenants.map((t) => t.name).join(', ')}`
      );
    }
  } else if (tenants.length === 1) {
    tenant = tenants[0];
  } else {
    throw new Error(
      `This database has ${tenants.length} tenants — set MCP_TENANT to one of: ` +
        tenants.map((t) => t.name).join(', ')
    );
  }

  const membership = await prisma.tenantUser.findFirst({
    where: {
      tenantId: tenant.id,
      ...(wantUser ? { user: { email: wantUser } } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  if (!membership) {
    throw new Error(
      wantUser
        ? `${wantUser} is not a member of ${tenant.name}.`
        : `${tenant.name} has no users.`
    );
  }

  return { tenant, user: membership.user };
}

async function main() {
  const { tenant, user } = await resolveIdentity();

  // Writes are opt-in. A read-only server is the safe default for something an
  // AI drives unattended, and it matches how the in-app panel treats writes.
  const allowWrites = process.env.MCP_ALLOW_WRITES === 'true';

  const ctx: ToolContext = {
    tenantId: tenant.id,
    userId: user.id,
    allowWrites,
  };

  // stderr, never stdout — stdout carries the MCP protocol itself.
  console.error(
    `[vibepsa-mcp] ${tenant.name} as ${user.email} — ${allowWrites ? 'read/write' : 'read-only'}`
  );

  const server = new Server(
    { name: 'vibepsa', version: '1.0.0' },
    {
      capabilities: { tools: {} },
      // The same domain briefing the in-app assistant gets, so a Claude Desktop
      // session knows that contracts absorb labour, values are net, and so on,
      // without being told each time.
      instructions: buildSystemPrompt(),
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: getToolDefinitions(ctx).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const result = await executeTool(name, (args ?? {}) as Record<string, any>, ctx);
    return {
      content: [{ type: 'text', text: result.content }],
      isError: result.isError ?? false,
    };
  });

  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(`[vibepsa-mcp] ${err.message}`);
  process.exit(1);
});
