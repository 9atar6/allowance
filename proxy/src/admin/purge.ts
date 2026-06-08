// =============================================================================
// POST /admin/purge — instant key revocation.
//
// The dashboard calls this on revoke to evict a key's cached context so the
// revoked key stops working immediately instead of after TTL expiry. Guarded by
// a shared bearer secret, constant-time compared.
//
// Body: { "keyHash": "<hex sha256 of the proxy key>" }
// =============================================================================

import type { Context } from "hono";
import { purgeCachedContext } from "../cache/context";
import { logEvent } from "../lib/log";
import { secretsMatch } from "../lib/secret";
import type { Env, Variables } from "../types";

const KEY_HASH_RE = /^[0-9a-f]{64}$/;

export async function handlePurge(
  c: Context<{ Bindings: Env; Variables: Variables }>,
): Promise<Response> {
  const secret = c.env.ADMIN_PURGE_SECRET;
  if (!secret) {
    return c.json({ error: "purge_not_configured" }, 503);
  }

  const token = (c.req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!(await secretsMatch(token, secret))) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const body = (await c.req.json().catch(() => null)) as { keyHash?: unknown } | null;
  const keyHash = body?.keyHash;
  if (typeof keyHash !== "string" || !KEY_HASH_RE.test(keyHash)) {
    return c.json({ error: "bad_request" }, 400);
  }

  await purgeCachedContext(c.env, keyHash);
  logEvent({ event: "cache_purged" }); // no key material logged
  return c.json({ purged: true });
}
