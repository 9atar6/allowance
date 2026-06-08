import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { KV_CTX_PREFIX } from "../src/config";
import { makeCtx, makeEnv } from "./helpers";

const HASH = "a".repeat(64); // valid 64-hex key hash
const SECRET = "purge-secret";

function purgeRequest(token: string | null, body: unknown) {
  return new Request("https://proxy.test/admin/purge", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("POST /admin/purge", () => {
  it("503s when no purge secret is configured", async () => {
    const env = makeEnv(); // ADMIN_PURGE_SECRET unset
    const { ctx } = makeCtx();
    const res = await app.fetch(purgeRequest(SECRET, { keyHash: HASH }), env, ctx);
    expect(res.status).toBe(503);
  });

  it("401s on a wrong secret and leaves the cache intact", async () => {
    const env = makeEnv({ ADMIN_PURGE_SECRET: SECRET });
    await env.WALLET_KV.put(`${KV_CTX_PREFIX}${HASH}`, JSON.stringify({ x: 1 }));
    const { ctx } = makeCtx();

    const res = await app.fetch(purgeRequest("wrong", { keyHash: HASH }), env, ctx);
    expect(res.status).toBe(401);
    expect(await env.WALLET_KV.get(`${KV_CTX_PREFIX}${HASH}`)).not.toBeNull();
  });

  it("400s on a malformed key hash", async () => {
    const env = makeEnv({ ADMIN_PURGE_SECRET: SECRET });
    const { ctx } = makeCtx();
    const res = await app.fetch(purgeRequest(SECRET, { keyHash: "nope" }), env, ctx);
    expect(res.status).toBe(400);
  });

  it("evicts the cached context with the correct secret", async () => {
    const env = makeEnv({ ADMIN_PURGE_SECRET: SECRET });
    await env.WALLET_KV.put(`${KV_CTX_PREFIX}${HASH}`, JSON.stringify({ x: 1 }));
    const { ctx } = makeCtx();

    const res = await app.fetch(purgeRequest(SECRET, { keyHash: HASH }), env, ctx);
    expect(res.status).toBe(200);
    expect(await env.WALLET_KV.get(`${KV_CTX_PREFIX}${HASH}`)).toBeNull();
  });
});
