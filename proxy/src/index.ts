// =============================================================================
// Allowance proxy — entrypoint.
//
// Request lifecycle (see docs/architecture/request-lifecycle.md):
//   auth (KV/edge) → authorize (balance) → forward → stream back → settle async
// =============================================================================

import { Hono } from "hono";
import { handlePurge } from "./admin/purge";
import { runLowBalanceAlerts } from "./cron/low-balance";
import { sendAlert } from "./lib/alert";
import {
  getDailySpend,
  getMonthlyCount,
  getProjectSpend,
  utcDateKey,
  utcMonthKey,
} from "./cache/context";
import { FREE_MONTHLY_REQUESTS, PROXY_BASE_PATH } from "./config";
import { logEvent } from "./lib/log";
import { buildX402Body } from "./lib/x402";
import { withinRateLimit } from "./lib/rate-limit";
import { authMiddleware } from "./middleware/auth";
import { computeCost } from "./proxy/cost";
import { forwardRequest, streamWithCount } from "./proxy/forward";
import { resolveActive } from "./proxy/route";
import { settle } from "./settlement/settle";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Liveness probe — no auth, no secrets.
app.get("/healthz", (c) => c.json({ ok: true }));

// Instant key revocation (shared-secret auth inside the handler).
app.post("/admin/purge", handlePurge);

// All proxy traffic flows through here. The key is resolved by authMiddleware.
app.all(`${PROXY_BASE_PATH}/*`, authMiddleware, async (c) => {
  const ctx = c.get("resolved");
  const requestId = c.get("requestId");
  const startedAt = Date.now();

  // Per-key rate limit (after auth so we key on the resolved key hash).
  if (!(await withinRateLimit(c.env, ctx.keyHash))) {
    logEvent({ event: "rate_limited", requestId, userId: ctx.userId });
    return c.json({ error: "rate_limited" }, 429);
  }

  // ── Resolve which service to hit (single endpoint, or project slug) ───────
  const { active, error } = resolveActive(ctx, c.req.url);
  if (!active) {
    if (error === "unknown_service") {
      logEvent({ event: "unknown_service", requestId, userId: ctx.userId });
      return c.json({ error: "unknown_service" }, 404);
    }
    logEvent({ event: "endpoint_unavailable", requestId, userId: ctx.userId, reason: "inactive_or_missing" });
    return c.json({ error: "endpoint_unavailable" }, 503);
  }

  // ── Free-plan monthly quota (hard cap so free users can't run up cost) ────
  if (ctx.plan === "free") {
    const usedThisMonth = await getMonthlyCount(c.env, ctx.userId, utcMonthKey());
    if (usedThisMonth >= FREE_MONTHLY_REQUESTS) {
      logEvent({ event: "free_quota_reached", requestId, userId: ctx.userId });
      return c.json(
        {
          error: "free_quota_reached",
          limit: FREE_MONTHLY_REQUESTS,
          used: usedThisMonth,
          upgradeUrl: "https://app.allowance.dev/billing",
        },
        402,
      );
    }
  }

  // ── Per-key daily limit (edge counter; null = unlimited) ──────────────────
  if (ctx.dailyLimit != null) {
    const spentToday = await getDailySpend(c.env, ctx.keyHash, utcDateKey());
    if (spentToday + active.costPerRequest > ctx.dailyLimit) {
      logEvent({ event: "daily_limit_reached", requestId, userId: ctx.userId });
      return c.json(
        { error: "daily_limit_reached", limit: ctx.dailyLimit, spentToday },
        402,
      );
    }
  }

  // ── Per-project monthly budget (edge counter; null = unlimited) ───────────
  if (ctx.projectId && ctx.monthlyBudget != null) {
    const spentThisMonth = await getProjectSpend(
      c.env,
      ctx.projectId,
      utcMonthKey(),
    );
    if (spentThisMonth + active.costPerRequest > ctx.monthlyBudget) {
      logEvent({ event: "project_budget_reached", requestId, userId: ctx.userId });
      return c.json(
        {
          error: "project_budget_reached",
          budget: ctx.monthlyBudget,
          spentThisMonth,
        },
        402,
      );
    }
  }

  // ── x402 hard-stop (advisory edge check; DB debit is authoritative) ───────
  if (ctx.balance < active.costPerRequest) {
    logEvent({ event: "payment_required", requestId, userId: ctx.userId, reason: "insufficient_balance" });
    return c.json(
      buildX402Body({
        resource: new URL(c.req.url).pathname,
        balance: ctx.balance,
        cost: active.costPerRequest,
        topUpUrl: "https://app.allowance.dev/billing",
      }),
      402,
    );
  }

  // ── Forward upstream ──────────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await forwardRequest(c.req.raw, active);
  } catch {
    logEvent({ event: "upstream_error", requestId, userId: ctx.userId });
    return c.json({ error: "upstream_unreachable" }, 502);
  }

  // ── Stream back + settle asynchronously once the stream drains ────────────
  // Register ONE waitUntil synchronously (before returning) that keeps the
  // worker alive until the body finishes piping, then settles. Scheduling
  // waitUntil from a later callback would be dropped by the runtime.
  const { response, done } = streamWithCount(upstream);

  c.executionCtx.waitUntil(
    done.then(({ chunkCount, usage }) => {
      // Don't charge the user for the upstream provider's own server errors.
      if (upstream.status >= 500) {
        logEvent({
          event: "upstream_5xx_no_charge",
          requestId,
          userId: ctx.userId,
          status: upstream.status,
        });
        return;
      }
      // flat fee, or per-token cost from the parsed usage (flat fallback).
      const cost = computeCost(active, usage);
      return settle(c.env, active, {
        requestId,
        statusCode: upstream.status,
        chunkCount,
        durationMs: Date.now() - startedAt,
        cost,
        usage,
      });
    }),
  );

  return response;
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

// Catch-all for unhandled errors: log, alert (best-effort), return a clean 500.
app.onError((err, c) => {
  const requestId = c.get("requestId");
  logEvent({ event: "unhandled_error", requestId });
  try {
    c.executionCtx.waitUntil(
      sendAlert(c.env, `Allowance worker error [${requestId ?? "-"}]: ${String(err).slice(0, 200)}`),
    );
  } catch {
    /* executionCtx may be absent in some contexts — ignore */
  }
  return c.json({ error: "internal_error" }, 500);
});

// fetch handler (HTTP) + scheduled handler (cron: low-balance alerts).
export default {
  fetch: app.fetch,
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): void {
    // Email users whose budget is running low.
    ctx.waitUntil(runLowBalanceAlerts(env));
  },
};
