// Test doubles: in-memory KV, a fake ExecutionContext that captures waitUntil
// tasks, and a fetch mock that stands in for Supabase RPCs, the upstream API,
// and Lago.
import { vi } from "vitest";
import type { Env, RpcProxyContext } from "../src/types";

/** Deterministic 32-byte edge key (base64) so crypto is reproducible in tests. */
export const TEST_EDGE_KEY = Buffer.from(new Uint8Array(32).fill(7)).toString(
  "base64",
);

/** Minimal in-memory KVNamespace (get json/text + put + delete). */
export function makeKV(): KVNamespace & { _store: Map<string, string> } {
  const store = new Map<string, string>();
  const kv = {
    _store: store,
    async get(key: string, type?: "json" | "text") {
      const raw = store.get(key);
      if (raw == null) return null;
      return type === "json" ? JSON.parse(raw) : raw;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
  return kv as unknown as KVNamespace & { _store: Map<string, string> };
}

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    WALLET_KV: makeKV(),
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    LAGO_API_URL: "https://lago.test",
    LAGO_API_KEY: "test-lago",
    LAGO_EVENT_CODE: "api_call",
    EDGE_ENCRYPTION_KEY: TEST_EDGE_KEY,
    KV_CONTEXT_TTL_SECONDS: "60",
    ...overrides,
  };
}

/** Fake ExecutionContext that records waitUntil promises so tests can await them. */
export function makeCtx() {
  const tasks: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      tasks.push(Promise.resolve(p));
    },
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
  return { ctx, flush: () => Promise.all(tasks) };
}

export interface FetchMock {
  proxyContext: RpcProxyContext | null;
  makeUpstream: () => Response;
  debitCalls: Array<Record<string, unknown>>;
  lagoCalls: string[];
  proxyContextCalls: string[];
  upstreamCalls: Array<{ url: string; method: string }>;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Install a global fetch stub that routes by URL to the right test double. */
export function installFetch(ctl: FetchMock) {
  const fn = vi.fn(
    async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.includes("/rpc/get_proxy_context")) {
        ctl.proxyContextCalls.push(url);
        return jsonResponse(ctl.proxyContext);
      }
      if (url.includes("/rpc/debit_wallet")) {
        ctl.debitCalls.push(
          init?.body ? JSON.parse(String(init.body)) : {},
        );
        return jsonResponse(true);
      }
      if (url.includes("lago.test")) {
        ctl.lagoCalls.push(url);
        return jsonResponse({});
      }
      ctl.upstreamCalls.push({ url, method });
      return ctl.makeUpstream();
    },
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** A valid baseline proxy context (sufficient balance, active endpoint). */
export function baseContext(over: Partial<RpcProxyContext> = {}): RpcProxyContext {
  return {
    user_id: "user-1",
    balance: 10,
    endpoint_id: "ep-1",
    target_url: "https://upstream.test/v1",
    cost_per_request: 0.01,
    metering_mode: "flat",
    input_token_cost: 0,
    output_token_cost: 0,
    endpoint_active: true,
    upstream_header: JSON.stringify({ Authorization: "Bearer sk-upstream" }),
    ...over,
  };
}

/** Build a ReadableStream-backed SSE response of N data frames. */
export function makeSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(encoder.encode(f));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}
