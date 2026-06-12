import { afterEach, describe, expect, it, vi } from "vitest";
import { buildWebhookPayload, isSafeWebhookUrl } from "../src/cron/spend-webhooks";
import { recordErrorAndMaybeAlert } from "../src/lib/alert";
import { base64ToBytes, bytesToBase64 } from "../src/lib/base64";
import { decryptEdge, encryptEdge } from "../src/lib/edge-crypto";
import { sha256Hex } from "../src/lib/hash";
import { buildX402Body } from "../src/lib/x402";
import {
  buildTargetUrl,
  forwardRequest,
  streamWithCount,
  UpstreamTimeoutError,
} from "../src/proxy/forward";
import type { ActiveRequest } from "../src/types";
import { makeEnv, TEST_EDGE_KEY } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

function activeReq(over: Partial<ActiveRequest> = {}): ActiveRequest {
  return {
    userId: "u",
    keyHash: "h",
    projectId: null,
    balance: 10,
    endpointId: "e",
    targetUrl: "https://upstream.test/v1",
    costPerRequest: 0.01,
    meteringMode: "flat",
    inputTokenCost: 0,
    outputTokenCost: 0,
    upstreamHeaders: { Authorization: "Bearer sk-upstream" },
    proxyPrefix: "/v1/proxy",
    ...over,
  };
}

describe("sha256Hex", () => {
  it("matches the known vector for 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
  it("is deterministic", async () => {
    expect(await sha256Hex("awk_live_x")).toBe(await sha256Hex("awk_live_x"));
  });
});

describe("base64", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect([...base64ToBytes(bytesToBase64(bytes))]).toEqual([...bytes]);
  });
});

describe("edge-crypto (AES-256-GCM)", () => {
  it("round-trips plaintext", async () => {
    const secret = JSON.stringify({ Authorization: "Bearer sk-123" });
    const ct = await encryptEdge(TEST_EDGE_KEY, secret);
    expect(ct).not.toContain("sk-123"); // must be ciphertext
    expect(await decryptEdge(TEST_EDGE_KEY, ct)).toBe(secret);
  });

  it("uses a fresh IV (same plaintext → different ciphertext)", async () => {
    const a = await encryptEdge(TEST_EDGE_KEY, "x");
    const b = await encryptEdge(TEST_EDGE_KEY, "x");
    expect(a).not.toBe(b);
  });

  it("rejects a tampered ciphertext", async () => {
    const ct = await encryptEdge(TEST_EDGE_KEY, "secret");
    const bytes = base64ToBytes(ct);
    bytes[bytes.length - 1] ^= 0xff; // flip last byte of the auth tag
    await expect(decryptEdge(TEST_EDGE_KEY, bytesToBase64(bytes))).rejects.toThrow();
  });

  it("rejects a wrong-length key", async () => {
    await expect(encryptEdge("c2hvcnQ=", "x")).rejects.toThrow(/32 bytes/);
  });
});

describe("buildTargetUrl", () => {
  it("appends the sub-path after the proxy base", () => {
    expect(
      buildTargetUrl(
        "https://proxy.test/v1/proxy/chat/completions",
        "https://upstream.test/v1",
        "/v1/proxy",
      ),
    ).toBe("https://upstream.test/v1/chat/completions");
  });

  it("preserves the query string", () => {
    expect(
      buildTargetUrl(
        "https://proxy.test/v1/proxy/models?limit=5",
        "https://upstream.test/v1",
        "/v1/proxy",
      ),
    ).toBe("https://upstream.test/v1/models?limit=5");
  });

  it("does not double slashes when the target has a trailing slash", () => {
    expect(
      buildTargetUrl(
        "https://proxy.test/v1/proxy/chat",
        "https://upstream.test/v1/",
        "/v1/proxy",
      ),
    ).toBe("https://upstream.test/v1/chat");
  });

  it("handles an empty sub-path", () => {
    expect(
      buildTargetUrl("https://proxy.test/v1/proxy", "https://upstream.test/v1", "/v1/proxy"),
    ).toBe("https://upstream.test/v1");
  });
});

describe("getCachedContext staleness", () => {
  it("discards snapshots older than the TTL even if KV still holds them", async () => {
    const { getCachedContext, putCachedContext } = await import(
      "../src/cache/context"
    );
    const env = makeEnv(); // KV_CONTEXT_TTL_SECONDS = 60
    const base = {
      user_id: "u1",
      balance: 5,
      plan: "free" as const,
      daily_limit: null,
      monthly_limit: null,
      project_id: null,
      monthly_budget: null,
      single: null,
      routes: [],
    };

    // Fresh snapshot: returned.
    await putCachedContext(env, "hash1", { ...base, cached_at: Date.now() });
    expect(await getCachedContext(env, "hash1")).not.toBeNull();

    // Snapshot fetched 61s ago: must be treated as a miss, even though
    // settlement keeps re-putting it (which resets the KV TTL).
    await putCachedContext(env, "hash2", {
      ...base,
      cached_at: Date.now() - 61_000,
    });
    expect(await getCachedContext(env, "hash2")).toBeNull();
  });
});

describe("isSafeWebhookUrl", () => {
  it("allows public https URLs only", () => {
    expect(isSafeWebhookUrl("https://discord.com/api/webhooks/x/y")).toBe(true);
    expect(isSafeWebhookUrl("http://example.com")).toBe(false);
    expect(isSafeWebhookUrl("https://localhost/x")).toBe(false);
    expect(isSafeWebhookUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isSafeWebhookUrl("https://10.0.0.8/hook")).toBe(false);
    expect(isSafeWebhookUrl("https://[fd00::1]/hook")).toBe(false);
    expect(isSafeWebhookUrl("not a url")).toBe(false);
  });
});

describe("buildWebhookPayload", () => {
  it("reports thresholds, remaining, and consumed percent", () => {
    const p = buildWebhookPayload(
      {
        user_id: "u1",
        url: "https://hook.test",
        balance: 1,
        baseline: 5,
        new_mask: 3,
        thresholds: [50, 80],
      },
      "2026-06-12T00:00:00.000Z",
    );
    expect(p.type).toBe("allowance.threshold_crossed");
    expect(p.thresholds).toEqual([50, 80]);
    expect(p.budgetRemaining).toBe(1);
    expect(p.consumedPercent).toBe(80);
    expect(p.firedAt).toBe("2026-06-12T00:00:00.000Z");
  });
  it("clamps consumed percent at 100 for negative balances", () => {
    const p = buildWebhookPayload(
      {
        user_id: "u1",
        url: "https://hook.test",
        balance: -0.02,
        baseline: 5,
        new_mask: 7,
        thresholds: [100],
      },
      "2026-06-12T00:00:00.000Z",
    );
    expect(p.consumedPercent).toBe(100);
  });
});

describe("buildX402Body", () => {
  it("reports the cost and remaining budget", () => {
    const body = buildX402Body({
      resource: "/v1/proxy/chat",
      balance: 0.004,
      cost: 0.01,
      topUpUrl: "https://app.test/dashboard",
    });
    expect(body.x402Version).toBe(1);
    expect(body.error).toBe("PAYMENT_REQUIRED");
    const accepts = body.accepts as Array<Record<string, unknown>>;
    expect(accepts[0].maxAmountRequired).toBe(0.01);
    expect(accepts[0].budgetRemaining).toBe(0.004);
  });
});

describe("forwardRequest", () => {
  it("strips our auth + cf headers and injects upstream credentials", async () => {
    let seen: Headers | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        seen = new Headers(init?.headers);
        return new Response("{}", { status: 200 });
      }),
    );

    const req = new Request("https://proxy.test/v1/proxy/chat", {
      method: "POST",
      headers: {
        Authorization: "Bearer alw_live_users_proxy_key",
        "cf-connecting-ip": "1.2.3.4",
        "x-custom": "kept",
        "content-type": "application/json",
      },
      body: "{}",
    });
    await forwardRequest(req, activeReq());

    expect(seen).not.toBeNull();
    // Our proxy key must NEVER reach the upstream; their real key must.
    expect(seen!.get("authorization")).toBe("Bearer sk-upstream");
    expect(seen!.get("cf-connecting-ip")).toBeNull();
    expect(seen!.get("x-custom")).toBe("kept");
  });

  it("throws UpstreamTimeoutError when headers never arrive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );

    const req = new Request("https://proxy.test/v1/proxy/chat", { method: "GET" });
    await expect(forwardRequest(req, activeReq(), 20)).rejects.toBeInstanceOf(
      UpstreamTimeoutError,
    );
  });

  it("does not convert a normal upstream failure into a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    const req = new Request("https://proxy.test/v1/proxy/chat", { method: "GET" });
    await expect(forwardRequest(req, activeReq(), 1000)).rejects.toBeInstanceOf(
      TypeError,
    );
  });
});

describe("recordErrorAndMaybeAlert", () => {
  it("alerts exactly once when the 5-min window crosses the threshold", async () => {
    const webhookCalls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        webhookCalls.push(url);
        return new Response("ok");
      }),
    );
    const env = makeEnv({ ALERT_WEBHOOK_URL: "https://hooks.test/alert" });

    for (let i = 0; i < 7; i++) {
      await recordErrorAndMaybeAlert(env, `boom ${i}`);
    }
    // Threshold is 5: silent for 1–4, one alert at 5, silent again for 6–7.
    expect(webhookCalls).toHaveLength(1);
  });

  it("is a no-op without a webhook configured", async () => {
    const fetchFn = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchFn);
    const env = makeEnv();
    for (let i = 0; i < 6; i++) await recordErrorAndMaybeAlert(env, "x");
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("streamWithCount", () => {
  it("passes the body through unchanged and counts chunks", async () => {
    const encoder = new TextEncoder();
    const upstream = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("hello "));
          controller.enqueue(encoder.encode("world"));
          controller.close();
        },
      }),
      { status: 200 },
    );

    const { response, done } = streamWithCount(upstream);
    const text = await response.text();
    expect(text).toBe("hello world");
    expect((await done).chunkCount).toBe(2);
  });

  it("handles a bodyless response", async () => {
    const { response, done } = streamWithCount(new Response(null, { status: 204 }));
    expect(response.status).toBe(204);
    const result = await done;
    expect(result.chunkCount).toBe(0);
    expect(result.usage).toBeNull();
  });
});
