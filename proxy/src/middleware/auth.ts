// =============================================================================
// Auth middleware — resolves the Bearer proxy key into an in-memory context.
//
// Cache-miss path:   key_hash -> get_proxy_context RPC -> encrypt cred -> cache
// Cache-hit path:    read KV -> decrypt cred in memory
//
// On success it sets c.var.resolved. It does NOT enforce balance (that's the
// handler's job, so the 402/x402 path is explicit in the main flow).
// =============================================================================

import { createMiddleware } from "hono/factory";
import { getCachedContext, putCachedContext } from "../cache/context";
import { decryptEdge, encryptEdge } from "../lib/edge-crypto";
import { sha256Hex } from "../lib/hash";
import { logEvent } from "../lib/log";
import { getProxyContext } from "../lib/supabase";
import type { CachedProxyContext, Env, ResolvedContext, Variables } from "../types";

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/** Safe JSON.parse of the decrypted header map; {} on anything malformed. */
function parseHeaderMap(json: string | null): Record<string, string> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const key = extractBearer(c.req.header("Authorization"));
  if (!key) {
    return c.json({ error: "missing_api_key" }, 401);
  }

  const keyHash = await sha256Hex(key);
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);

  let resolved: ResolvedContext | null = null;

  // ── Cache hit ───────────────────────────────────────────────────────────
  const cached = await getCachedContext(c.env, keyHash);
  if (cached) {
    try {
      const headerJson = cached.upstream_header_enc
        ? await decryptEdge(c.env.EDGE_ENCRYPTION_KEY, cached.upstream_header_enc)
        : null;
      resolved = {
        userId: cached.user_id,
        balance: cached.balance,
        endpointId: cached.endpoint_id,
        targetUrl: cached.target_url,
        costPerRequest: cached.cost_per_request,
        meteringMode: cached.metering_mode,
        inputTokenCost: cached.input_token_cost,
        outputTokenCost: cached.output_token_cost,
        endpointActive: cached.endpoint_active,
        upstreamHeaders: parseHeaderMap(headerJson),
        keyHash,
      };
      logEvent({ event: "auth_resolved", requestId, userId: resolved.userId, cacheHit: true });
    } catch {
      // Decrypt failed (rotated EDGE_ENCRYPTION_KEY / corrupt blob). Treat as a
      // miss and re-warm from the DB rather than failing the request.
      resolved = null;
      logEvent({ event: "cache_decrypt_failed", requestId, reason: "stale_or_corrupt" });
    }
  }

  // ── Cache miss (or unusable cache) → single DB round-trip, then re-warm ────
  if (!resolved) {
    const ctx = await getProxyContext(c.env, keyHash);
    if (!ctx) {
      return c.json({ error: "invalid_api_key" }, 401);
    }

    // Encrypt the credential before it ever touches KV.
    const encrypted = ctx.upstream_header
      ? await encryptEdge(c.env.EDGE_ENCRYPTION_KEY, ctx.upstream_header)
      : null;

    const toCache: CachedProxyContext = {
      user_id: ctx.user_id,
      balance: ctx.balance,
      endpoint_id: ctx.endpoint_id,
      target_url: ctx.target_url,
      cost_per_request: ctx.cost_per_request,
      metering_mode: ctx.metering_mode,
      input_token_cost: ctx.input_token_cost,
      output_token_cost: ctx.output_token_cost,
      endpoint_active: ctx.endpoint_active,
      upstream_header_enc: encrypted,
      cached_at: Date.now(),
    };
    await putCachedContext(c.env, keyHash, toCache);

    resolved = {
      userId: ctx.user_id,
      balance: ctx.balance,
      endpointId: ctx.endpoint_id,
      targetUrl: ctx.target_url,
      costPerRequest: ctx.cost_per_request,
      meteringMode: ctx.metering_mode,
      inputTokenCost: ctx.input_token_cost,
      outputTokenCost: ctx.output_token_cost,
      endpointActive: ctx.endpoint_active,
      upstreamHeaders: parseHeaderMap(ctx.upstream_header),
      keyHash,
    };
    logEvent({ event: "auth_resolved", requestId, userId: resolved.userId, cacheHit: false });
  }

  c.set("resolved", resolved);
  await next();
});
