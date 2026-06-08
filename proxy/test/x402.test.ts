import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { encodeXPaymentResponse } from "../src/x402/codec";
import { usdToAtomic } from "../src/x402/requirements";
import { baseContext, makeCtx, makeEnv } from "./helpers";
import type { Env } from "../src/types";

// ── pure helpers ─────────────────────────────────────────────────────────────
describe("usdToAtomic", () => {
  it("converts USD to 6-decimal USDC atomic units", () => {
    expect(usdToAtomic(5, 6)).toBe("5000000");
    expect(usdToAtomic(0.01, 6)).toBe("10000");
    expect(usdToAtomic(100, 6)).toBe("100000000");
  });
});

// ── topup endpoint ───────────────────────────────────────────────────────────
const KEY = "alw_live_testkey";
const X402_ENV: Partial<Env> = {
  X402_RECEIVING_WALLET: "0xReceiver",
  X402_FACILITATOR_URL: "https://facilitator.test",
  X402_NETWORK: "base-sepolia",
  X402_ASSET: "0xUSDC",
  X402_ASSET_DECIMALS: "6",
};

interface TopupMock {
  verifyResponse: { isValid: boolean; invalidReason?: string };
  settleResponse: { success: boolean; transaction?: string; errorReason?: string };
  verifyCalls: number;
  settleCalls: number;
  creditCalls: Array<Record<string, unknown>>;
}

function installFetch(m: TopupMock) {
  const json = (v: unknown) =>
    new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } });
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/rpc/get_proxy_context")) return json(baseContext());
    if (url.endsWith("/verify")) {
      m.verifyCalls++;
      return json(m.verifyResponse);
    }
    if (url.endsWith("/settle")) {
      m.settleCalls++;
      return json(m.settleResponse);
    }
    if (url.includes("/rpc/credit_wallet")) {
      m.creditCalls.push(init?.body ? JSON.parse(String(init.body)) : {});
      return json(true);
    }
    return json({});
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

function topupRequest(amount: number, xPayment?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${KEY}` };
  if (xPayment) headers["X-PAYMENT"] = xPayment;
  return new Request(`https://proxy.test/v1/topup/${amount}`, { method: "POST", headers });
}

function newMock(over: Partial<TopupMock> = {}): TopupMock {
  return {
    verifyResponse: { isValid: true },
    settleResponse: { success: true, transaction: "0xtxhash123" },
    verifyCalls: 0,
    settleCalls: 0,
    creditCalls: [],
    ...over,
  };
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("POST /v1/topup/:amount", () => {
  it("503s when x402 is not configured", async () => {
    installFetch(newMock());
    const { ctx } = makeCtx();
    const res = await app.fetch(topupRequest(5), makeEnv(), ctx);
    expect(res.status).toBe(503);
  });

  it("400s on a non-tier amount", async () => {
    installFetch(newMock());
    const { ctx } = makeCtx();
    const res = await app.fetch(topupRequest(7), makeEnv(X402_ENV), ctx);
    expect(res.status).toBe(400);
  });

  it("challenges with 402 + payment requirements when X-PAYMENT is absent", async () => {
    installFetch(newMock());
    const { ctx } = makeCtx();
    const res = await app.fetch(topupRequest(5), makeEnv(X402_ENV), ctx);
    expect(res.status).toBe(402);
    const body = (await res.json()) as { x402Version: number; accepts: Array<Record<string, unknown>> };
    expect(body.x402Version).toBe(1);
    expect(body.accepts[0].maxAmountRequired).toBe("5000000");
    expect(body.accepts[0].payTo).toBe("0xReceiver");
    expect(body.accepts[0].network).toBe("base-sepolia");
  });

  it("re-challenges (402) when the facilitator says the payment is invalid", async () => {
    const m = newMock({ verifyResponse: { isValid: false, invalidReason: "bad sig" } });
    installFetch(m);
    const { ctx } = makeCtx();
    const xpay = encodeXPaymentResponse({ x402Version: 1, scheme: "exact", network: "base-sepolia", payload: {} });
    const res = await app.fetch(topupRequest(5, xpay), makeEnv(X402_ENV), ctx);
    expect(res.status).toBe(402);
    expect(m.settleCalls).toBe(0); // never settled an invalid payment
    expect(m.creditCalls).toHaveLength(0);
  });

  it("verifies, settles, and credits on a valid payment", async () => {
    const m = newMock();
    installFetch(m);
    const { ctx } = makeCtx();
    const xpay = encodeXPaymentResponse({ x402Version: 1, scheme: "exact", network: "base-sepolia", payload: {} });
    const res = await app.fetch(topupRequest(25, xpay), makeEnv(X402_ENV), ctx);

    expect(res.status).toBe(200);
    expect(m.verifyCalls).toBe(1);
    expect(m.settleCalls).toBe(1);
    // Credited $25 to the resolved user, idempotent on the tx hash.
    expect(m.creditCalls).toHaveLength(1);
    expect(m.creditCalls[0].p_amount).toBe(25);
    expect(m.creditCalls[0].p_type).toBe("topup");
    expect(m.creditCalls[0].p_external_ref).toBe("0xtxhash123");
    // Settlement receipt returned to the client.
    expect(res.headers.get("X-PAYMENT-RESPONSE")).toBeTruthy();
  });

  it("does NOT credit when settlement fails", async () => {
    const m = newMock({ settleResponse: { success: false, errorReason: "insufficient funds" } });
    installFetch(m);
    const { ctx } = makeCtx();
    const xpay = encodeXPaymentResponse({ x402Version: 1, scheme: "exact", network: "base-sepolia", payload: {} });
    const res = await app.fetch(topupRequest(5, xpay), makeEnv(X402_ENV), ctx);
    expect(res.status).toBe(402);
    expect(m.creditCalls).toHaveLength(0);
  });
});
