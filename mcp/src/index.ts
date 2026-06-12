#!/usr/bin/env node
// =============================================================================
// allowance-mcp — MCP server for Allowance (getallowance.dev).
//
// Gives an AI agent visibility into its own API spending: budget left, every
// cap with spent/remaining, and what a 402 means. Read-only by design: the
// alw_ key it holds can spend (through the proxy) and inspect itself, but
// can never raise its own limits. Humans manage budgets on the dashboard.
//
// Config (env):
//   ALLOWANCE_API_KEY   required — the agent's alw_live_ key
//   ALLOWANCE_BASE_URL  optional — defaults to https://api.getallowance.dev
// =============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = (
  process.env.ALLOWANCE_BASE_URL ?? "https://api.getallowance.dev"
).replace(/\/+$/, "");
const API_KEY = process.env.ALLOWANCE_API_KEY;

const REQUEST_TIMEOUT_MS = 15_000;

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function text(s: string, isError = false): ToolResult {
  return { content: [{ type: "text", text: s }], isError };
}

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body };
}

const server = new McpServer({ name: "allowance", version: "0.1.0" });

server.tool(
  "check_budget",
  "Check this agent's Allowance spend state: budget remaining (USD), plan, " +
    "and every configured cap (daily/monthly/project/free-quota) with " +
    "spent and remaining amounts. Costs nothing to call (no upstream " +
    "request is made). Call it before starting expensive work, and when a " +
    "request fails with HTTP 402.",
  {},
  async (): Promise<ToolResult> => {
    if (!API_KEY) {
      return text(
        "ALLOWANCE_API_KEY is not set. Add the agent's alw_live_ key to the MCP server's environment.",
        true,
      );
    }
    try {
      const { status, body } = await getJson("/v1/me");
      if (status === 401) {
        return text(
          "The Allowance key was rejected (401). It may be revoked or expired; a human should mint a new one at https://getallowance.dev/dashboard.",
          true,
        );
      }
      if (status !== 200) {
        return text(`Allowance answered ${status}. Try again shortly.`, true);
      }
      return text(JSON.stringify(body, null, 2));
    } catch {
      return text("Could not reach the Allowance API (network error).", true);
    }
  },
);

server.tool(
  "explain_payment_required",
  "Interpret an HTTP 402 response body from the Allowance proxy. Returns " +
    "which cap tripped, how much (if anything) remains, and what the agent " +
    "can do about it (wait for a reset, finish with cheaper calls, or ask a " +
    "human to raise the cap).",
  { responseBody: z.string().describe("The raw JSON body of the 402 response") },
  async ({ responseBody }): Promise<ToolResult> => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(responseBody) as Record<string, unknown>;
    } catch {
      return text("That is not valid JSON. Pass the exact 402 response body.", true);
    }
    const code = String(parsed.error ?? "unknown");
    const explanations: Record<string, string> = {
      PAYMENT_REQUIRED:
        "The account budget is exhausted. Calls stop until a human raises the budget on the dashboard (or the monthly allowance refills it).",
      free_quota_reached:
        "The free plan's monthly request quota is used up. It resets on the 1st (UTC), or a human can upgrade to Pro.",
      daily_limit_reached:
        "This key's daily spending cap tripped. It resets at midnight UTC; until then, only a human can raise the cap.",
      monthly_limit_reached:
        "This key's monthly spending cap tripped. It resets on the 1st (UTC).",
      project_budget_reached:
        "The whole project's monthly budget tripped. It resets on the 1st (UTC), or a human can raise it.",
    };
    const explanation =
      explanations[code] ?? `Unrecognized error code "${code}".`;
    const remaining = parsed.remaining != null ? ` Remaining: $${parsed.remaining}.` : "";
    const hint = parsed.retryHint ? ` Hint from the proxy: ${parsed.retryHint}` : "";
    return text(`${explanation}${remaining}${hint}`);
  },
);

server.tool(
  "check_service_health",
  "Check whether the Allowance proxy itself is up (its /healthz endpoint). " +
    "Useful to distinguish 'Allowance is down' from 'my key/budget has a problem'.",
  {},
  async (): Promise<ToolResult> => {
    try {
      const res = await fetch(`${BASE_URL}/healthz`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      return text(
        res.ok
          ? "Allowance proxy is up."
          : `Allowance proxy answered ${res.status}. Status page: https://stats.uptimerobot.com/bewvMY4MqN`,
        !res.ok,
      );
    } catch {
      return text(
        "Could not reach the Allowance proxy. Status page: https://stats.uptimerobot.com/bewvMY4MqN",
        true,
      );
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
