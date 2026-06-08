import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { KV_CTX_PREFIX } from "../src/config";
import { sha256Hex } from "../src/lib/hash";
import type { CachedProxyContext } from "../src/types";
import {
  baseContext,
  installFetch,
  makeCtx,
  makeEnv,
  makeSseResponse,
  type FetchMock,
} from "./helpers";

const KEY = "awk_live_testkey";

function newCtl(over: Partial<FetchMock> = {}): FetchMock {
  return {
    proxyContext: baseContext(),
    makeUpstream: () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    debitCalls: [],
    lagoCalls: [],
    proxyContextCalls: [],
    upstreamCalls: [],
    ...over,
  };
}

function proxyRequest(headers: Record<string, string> = { Authorization: `Bearer ${KEY}` }) {
  return new Request("https://proxy.test/v1/proxy/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ model: "gpt-4o", messages: [] }),
  });
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("proxy handler", () => {
  it("401s when the Authorization header is missing", async () => {
    const ctl = newCtl();
    installFetch(ctl);
    const { ctx } = makeCtx();
    const res = await app.fetch(proxyRequest({}), makeEnv(), ctx);
    expect(res.status).toBe(401);
    expect(ctl.proxyContextCalls).toHaveLength(0);
  });

  it("401s for an unknown key (context is null)", async () => {
    const ctl = newCtl({ proxyContext: null });
    installFetch(ctl);
    const { ctx } = makeCtx();
    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    expect(res.status).toBe(401);
    expect(ctl.upstreamCalls).toHaveLength(0);
  });

  it("hard-stops with 402 + x402 body when balance < cost", async () => {
    const ctl = newCtl({ proxyContext: baseContext({ balance: 0.005 }) });
    installFetch(ctl);
    const { ctx, flush } = makeCtx();

    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    await flush();

    expect(res.status).toBe(402);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.x402Version).toBe(1);
    expect(ctl.upstreamCalls).toHaveLength(0); // never forwarded
    expect(ctl.debitCalls).toHaveLength(0); // never charged
  });

  it("429s when the per-key rate limit is exceeded", async () => {
    const ctl = newCtl();
    installFetch(ctl);
    const env = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const { ctx } = makeCtx();

    const res = await app.fetch(proxyRequest(), env, ctx);
    expect(res.status).toBe(429);
    expect(ctl.upstreamCalls).toHaveLength(0); // never forwarded
    expect(ctl.debitCalls).toHaveLength(0); // never charged
  });

  it("503s when the endpoint is inactive", async () => {
    const ctl = newCtl({ proxyContext: baseContext({ endpoint_active: false }) });
    installFetch(ctl);
    const { ctx } = makeCtx();
    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    expect(res.status).toBe(503);
    expect(ctl.upstreamCalls).toHaveLength(0);
  });

  it("forwards, injects upstream creds, streams back, and settles", async () => {
    const ctl = newCtl();
    const fetchFn = installFetch(ctl);
    const env = makeEnv();
    const { ctx, flush } = makeCtx();

    const res = await app.fetch(proxyRequest(), env, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    // Correct upstream URL (sub-path appended).
    expect(ctl.upstreamCalls[0].url).toBe("https://upstream.test/v1/chat/completions");

    // Upstream call carried the decrypted credential, NOT our proxy key.
    const upstreamInit = fetchFn.mock.calls.find(([u]) =>
      String(u).startsWith("https://upstream.test"),
    )?.[1] as RequestInit | undefined;
    const sentHeaders = new Headers(upstreamInit?.headers);
    expect(sentHeaders.get("Authorization")).toBe("Bearer sk-upstream");

    // Settlement (waitUntil) ran: debit happened with the flat cost.
    await flush();
    expect(ctl.debitCalls).toHaveLength(1);
    expect(ctl.debitCalls[0].p_cost).toBe(0.01);
    expect(ctl.debitCalls[0].p_request_id).toBeTruthy();

    // KV balance snapshot decremented 10 → 9.99.
    const hash = await sha256Hex(KEY);
    const cached = (await env.WALLET_KV.get(
      `${KV_CTX_PREFIX}${hash}`,
      "json",
    )) as CachedProxyContext;
    expect(cached.balance).toBeCloseTo(9.99, 6);
    // Credential cached as ciphertext, never plaintext.
    expect(cached.upstream_header_enc).not.toContain("sk-upstream");
  });

  it("streams SSE through and counts chunks for settlement", async () => {
    const ctl = newCtl({
      makeUpstream: () => makeSseResponse(["data: a\n\n", "data: b\n\n", "data: [DONE]\n\n"]),
    });
    installFetch(ctl);
    const { ctx, flush } = makeCtx();

    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(await res.text()).toBe("data: a\n\ndata: b\n\ndata: [DONE]\n\n");

    await flush();
    expect(ctl.debitCalls).toHaveLength(1);
    expect(ctl.debitCalls[0].p_chunk_count).toBe(3);
  });

  it("bills per-token cost from the SSE usage frame", async () => {
    const ctl = newCtl({
      proxyContext: baseContext({
        metering_mode: "per_token",
        input_token_cost: 0.000001,
        output_token_cost: 0.000002,
      }),
      makeUpstream: () =>
        makeSseResponse([
          'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
          'data: {"usage":{"prompt_tokens":1000,"completion_tokens":500}}\n\n',
          "data: [DONE]\n\n",
        ]),
    });
    installFetch(ctl);
    const { ctx, flush } = makeCtx();

    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    await res.text(); // drain
    await flush();

    expect(ctl.debitCalls).toHaveLength(1);
    // 1000*1e-6 + 500*2e-6 = 0.002
    expect(ctl.debitCalls[0].p_cost).toBeCloseTo(0.002, 9);
    expect(ctl.debitCalls[0].p_prompt_tokens).toBe(1000);
    expect(ctl.debitCalls[0].p_completion_tokens).toBe(500);
  });

  it("does NOT charge when the upstream returns 5xx", async () => {
    const ctl = newCtl({
      makeUpstream: () => new Response("upstream boom", { status: 503 }),
    });
    installFetch(ctl);
    const { ctx, flush } = makeCtx();

    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    expect(res.status).toBe(503);
    await res.text(); // drain the passthrough stream so settlement can complete
    await flush();

    expect(ctl.debitCalls).toHaveLength(0);
  });

  it("serves a second request from KV without re-querying the DB", async () => {
    const ctl = newCtl();
    installFetch(ctl);
    const env = makeEnv();

    const first = makeCtx();
    const r1 = await app.fetch(proxyRequest(), env, first.ctx);
    await r1.text(); // drain
    await first.flush();
    expect(ctl.proxyContextCalls).toHaveLength(1);

    // Second request: context comes from the edge cache (no new RPC).
    const second = makeCtx();
    const res = await app.fetch(proxyRequest(), env, second.ctx);
    await res.text(); // drain
    await second.flush();
    expect(res.status).toBe(200);
    expect(ctl.proxyContextCalls).toHaveLength(1); // still 1 — cache hit
  });
});
