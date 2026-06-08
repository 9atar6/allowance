import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureLagoProvisioned } from "@/lib/lago";

function stubFetch() {
  const fn = vi.fn(
    async (_input: string | URL | Request, _init?: RequestInit) =>
      new Response("{}", { status: 200 }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ensureLagoProvisioned", () => {
  it("is a no-op when Lago env is not configured", async () => {
    vi.stubEnv("LAGO_API_KEY", "");
    vi.stubEnv("LAGO_API_URL", "");
    vi.stubEnv("LAGO_PLAN_CODE", "");
    const fetchFn = stubFetch();

    await ensureLagoProvisioned("user-1", "a@b.co");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("upserts the customer then the subscription with the right keys", async () => {
    vi.stubEnv("LAGO_API_URL", "https://lago.test");
    vi.stubEnv("LAGO_API_KEY", "lago_k");
    vi.stubEnv("LAGO_PLAN_CODE", "api_wallet_usage");
    const fetchFn = stubFetch();

    await ensureLagoProvisioned("user-1", "a@b.co");

    expect(fetchFn).toHaveBeenCalledTimes(2);

    const [custUrl, custInit] = fetchFn.mock.calls[0];
    expect(String(custUrl)).toBe("https://lago.test/api/v1/customers");
    expect(JSON.parse(String(custInit?.body))).toEqual({
      customer: { external_id: "user-1", email: "a@b.co" },
    });

    const [subUrl, subInit] = fetchFn.mock.calls[1];
    expect(String(subUrl)).toBe("https://lago.test/api/v1/subscriptions");
    expect(JSON.parse(String(subInit?.body))).toEqual({
      subscription: {
        external_customer_id: "user-1",
        external_id: "user-1",
        plan_code: "api_wallet_usage",
      },
    });
  });

  it("swallows network errors (best-effort, never throws)", async () => {
    vi.stubEnv("LAGO_API_URL", "https://lago.test");
    vi.stubEnv("LAGO_API_KEY", "lago_k");
    vi.stubEnv("LAGO_PLAN_CODE", "api_wallet_usage");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(ensureLagoProvisioned("user-1", "a@b.co")).resolves.toBeUndefined();
  });
});
