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
  makeRoute,
  makeSseResponse,
  projectContext,
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
    // Agent-readable contract: every 402 says what's left and what to do.
    expect(body.remaining).toBe(0.005);
    expect(typeof body.retryHint).toBe("string");
    expect(typeof body.manageUrl).toBe("string");
    expect(ctl.upstreamCalls).toHaveLength(0); // never forwarded
    expect(ctl.debitCalls).toHaveLength(0); // never charged
  });

  it("returns x-allowance-* spend headers on successful proxied calls", async () => {
    const ctl = newCtl({
      proxyContext: baseContext({ balance: 5, daily_limit: 2 }),
    });
    installFetch(ctl);
    const { ctx, flush } = makeCtx();

    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    await res.text(); // drain the stream so settlement can run
    await flush();

    expect(res.status).toBe(200);
    // budget 5 - cost 0.01 = 4.99
    expect(res.headers.get("x-allowance-budget-remaining")).toBe("4.990000");
    // daily cap 2 - 0 spent - 0.01 = 1.99
    expect(res.headers.get("x-allowance-daily-remaining")).toBe("1.990000");
    // no monthly/project caps configured -> headers absent
    expect(res.headers.get("x-allowance-monthly-remaining")).toBeNull();
    expect(res.headers.get("x-allowance-project-remaining")).toBeNull();
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

  it("413s when the request body exceeds the size limit", async () => {
    const ctl = newCtl();
    installFetch(ctl);
    const { ctx } = makeCtx();

    const big = new Request("https://proxy.test/v1/proxy/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "content-type": "application/json",
        "content-length": String(11 * 1024 * 1024), // 11 MB > 10 MB cap
      },
      body: "{}",
    });
    const res = await app.fetch(big, makeEnv(), ctx);
    expect(res.status).toBe(413);
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
    expect(cached.single?.upstream_header_enc).not.toContain("sk-upstream");
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

  it("routes a project key to the right service by slug", async () => {
    const ctl = newCtl({
      proxyContext: projectContext([makeRoute("openai"), makeRoute("anthropic")]),
    });
    const fetchFn = installFetch(ctl);
    const { ctx, flush } = makeCtx();

    const req = new Request("https://proxy.test/v1/proxy/openai/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: "x" }),
    });
    const res = await app.fetch(req, makeEnv(), ctx);
    await res.text();
    await flush();

    expect(res.status).toBe(200);
    // Forwarded to the openai route with the slug stripped from the path.
    expect(ctl.upstreamCalls[0].url).toBe("https://openai.test/v1/chat/completions");
    // Injected that route's credential.
    const init = fetchFn.mock.calls.find(([u]) =>
      String(u).startsWith("https://openai.test"),
    )?.[1] as RequestInit | undefined;
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer sk-openai");
  });

  it("404s a project key for an unknown service slug", async () => {
    const ctl = newCtl({ proxyContext: projectContext([makeRoute("openai")]) });
    installFetch(ctl);
    const { ctx } = makeCtx();

    const req = new Request("https://proxy.test/v1/proxy/unknown/x", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const res = await app.fetch(req, makeEnv(), ctx);
    expect(res.status).toBe(404);
    expect(ctl.upstreamCalls).toHaveLength(0);
  });

  it("402s when the per-key daily limit is exceeded", async () => {
    const ctl = newCtl({ proxyContext: baseContext({ daily_limit: 0.005 }) }); // < 0.01 cost
    installFetch(ctl);
    const { ctx } = makeCtx();

    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("daily_limit_reached");
    expect(ctl.upstreamCalls).toHaveLength(0);
  });

  it("402s when the per-key monthly limit is exceeded", async () => {
    const ctl = newCtl({ proxyContext: baseContext({ monthly_limit: 0.005 }) }); // < 0.01 cost
    installFetch(ctl);
    const { ctx } = makeCtx();

    const res = await app.fetch(proxyRequest(), makeEnv(), ctx);
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("monthly_limit_reached");
    expect(ctl.upstreamCalls).toHaveLength(0);
  });
});
