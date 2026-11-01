# Connecting Xanty PSA to Claude Desktop (MCP)

The MCP server exposes Xanty PSA to Claude Desktop, Claude Code, or any other MCP
client, so you can ask for work in plain English instead of clicking through
screens:

> "How many tickets did we open for Acme last month, and which ones are still
> unresolved?"
>
> "Create an opportunity for Acme, £12,000, closing end of next month."

## What it exposes

Four tools, shared with the in-app AI panel - they are imported from
`src/lib/ai/tools.ts` rather than written twice, so the two can't drift apart.

| Tool | What it does |
|---|---|
| `describe_schema` | Field list, types and allowed values for any model |
| `query_records` | Filtered reads against any of the 58 models |
| `run_analytics_query` | Read-only SQL for aggregates and date maths |
| `create_record` | Creates a record - **only when writes are enabled** |

`query_records` and `create_record` work against every model, so four general
tools cover the whole schema rather than needing a couple of hundred
hand-written ones.

## Setup

Run it once from the terminal to check it starts:

```bash
npm run mcp
```

It should print the tenant and user it is acting as, then sit waiting for a
client. `Ctrl-C` to stop.

Then add it to Claude Desktop's config file, at
`~/Library/Application Support/Claude/claude_desktop_config.json` on a Mac:

```json
{
  "mcpServers": {
    "xantypsa": {
      "command": "npx",
      "args": [
        "tsx",
        "--env-file=.env",
        "src/mcp/server.ts"
      ],
      "cwd": "/absolute/path/to/xantypsa",
      "env": {
        "MCP_TENANT": "Your Company Ltd"
      }
    }
  }
}
```

Restart Claude Desktop. Xanty PSA appears in the tools menu.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `MCP_TENANT` | required when the database has more than one tenant | Tenant name or id |
| `MCP_USER_EMAIL` | first user in the tenant | Who actions are attributed to |
| `MCP_ALLOW_WRITES` | `false` | Set `true` to expose `create_record` |

**Writes are off by default.** With `MCP_ALLOW_WRITES` unset the server can only
read, and `create_record` is not offered to the client at all. Turn it on
deliberately, once you're comfortable with what the assistant is doing.

## How it's scoped

The tenant is resolved once, at startup, from the environment. The MCP client
never gets to choose it, so no prompt - however it's phrased, and whatever it
claims - can talk the server into reading another tenant's data.

Records created over MCP get their reference numbers (`TKT-`, `QTE-`, `INV-`,
`CON-`) assigned the same way the API routes assign them, so they are
indistinguishable from records created through the UI.

`run_analytics_query` runs through the restricted, SELECT-only database role
described in [SECURITY-AI.md](SECURITY-AI.md), with row-level security scoping
every table to the one tenant.

## Troubleshooting

**"This database has N tenants - set MCP_TENANT"** - exactly what it says; the
error lists the available names.

**Claude Desktop shows the server as failed** - it captures stderr in
`~/Library/Logs/Claude/mcp-server-xantypsa.log`. The usual cause is a `cwd` that
isn't the project root, so `.env` can't be found.

**Nothing appears in the tools menu** - Claude Desktop only reads its config at
launch. Quit it fully and reopen.
