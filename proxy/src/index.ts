// =============================================================================
// Allowance proxy — entrypoint.
//
// Request lifecycle (see docs/architecture/request-lifecycle.md):
//   auth (KV/edge) → authorize (balance) → forward → stream back → settle async
// =============================================================================

import { Hono } from "hono";
import { handlePurge } from "./admin/purge";
import { PROXY_BASE_PATH } from "./config";
import { logEvent } from "./lib/log";
import { buildX402Body } from "./lib/x402";
import { withinRateLimit } from "./lib/rate-limit";
import { authMiddleware } from "./middleware/auth";
import { computeCost } from "./proxy/cost";
import { forwardRequest, streamWithCount } from "./proxy/forward";
import { settle } from "./settlement/settle";
import type { Env, Variables } from "./types";
import { handleTopup } from "./x402/topup";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Liveness probe — no auth, no secrets.
app.get("/healthz", (c) => c.json({ ok: true }));

// Instant key revocation (shared-secret auth inside the handler).
app.post("/admin/purge", handlePurge);

// x402 crypto top-up: fund a prepaid balance with USDC (auth'd by proxy key).
app.post("/v1/topup/:amount", authMiddleware, handleTopup);

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

  // Endpoint must exist and be active.
  if (!ctx.endpointActive || !ctx.targetUrl) {
    logEvent({ event: "endpoint_unavailable", requestId, userId: ctx.userId, reason: "inactive_or_missing" });
    return c.json({ error: "endpoint_unavailable" }, 503);
  }

  // ── x402 hard-stop (advisory edge check; DB debit is authoritative) ───────
  if (ctx.balance < ctx.costPerRequest) {
    logEvent({ event: "payment_required", requestId, userId: ctx.userId, reason: "insufficient_balance" });
    return c.json(
      buildX402Body({
        resource: new URL(c.req.url).pathname,
        balance: ctx.balance,
        cost: ctx.costPerRequest,
        topUpUrl: "https://app.allowance.dev/billing",
      }),
      402,
    );
  }

  // ── Forward upstream ──────────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await forwardRequest(c.req.raw, ctx);
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
      const cost = computeCost(ctx, usage);
      return settle(c.env, ctx, {
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

export default app;
