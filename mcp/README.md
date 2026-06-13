# allowance-mcp

MCP server for [Allowance](https://getallowance.dev): gives AI agents
visibility into their own API spending budget.

An agent holding an Allowance key (`alw_live_...`) can:

- **check_budget** — read its budget remaining and every cap (daily, monthly,
  project, free quota) with spent/remaining amounts. Free to call.
- **explain_payment_required** — turn a raw HTTP 402 body from the proxy into
  a plain-language explanation and a recommended next step.
- **check_service_health** — distinguish "Allowance is down" from "my key or
  budget has a problem".
- **mint_pocket_money** — hand a sub-agent a capped, optionally-expiring child
  key carved from this key's access (child spend also debits the parent
  account; one level deep).

Read-only by design: the key can spend (through the proxy) and inspect
itself, but can never raise its own limits. Humans manage budgets on the
[dashboard](https://getallowance.dev/dashboard).

## Setup

```bash
cd mcp && npm install && npm run build
```

### Claude Code

```bash
claude mcp add allowance \
  --env ALLOWANCE_API_KEY=alw_live_your_key \
  -- node /path/to/allowance/mcp/dist/index.js
```

### Claude Desktop / other MCP clients

```json
{
  "mcpServers": {
    "allowance": {
      "command": "node",
      "args": ["/path/to/allowance/mcp/dist/index.js"],
      "env": { "ALLOWANCE_API_KEY": "alw_live_your_key" }
    }
  }
}
```

## Configuration

| Env var              | Required | Default                          |
| -------------------- | -------- | -------------------------------- |
| `ALLOWANCE_API_KEY`  | yes      | —                                |
| `ALLOWANCE_BASE_URL` | no       | `https://api.getallowance.dev`   |

## Why give an agent its own budget visibility?

A hard 402 wall is hostile to autonomous agents. With this server, an agent
can check its remaining budget before an expensive task, watch it shrink via
the proxy's `x-allowance-*` response headers, and react to a 402 with a plan
(wait for the UTC reset, finish with cheaper calls, or ask its operator)
instead of crashing.
