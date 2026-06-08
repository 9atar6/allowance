import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purgeProxyKeyCache } from "@/lib/proxy-admin";

const HASH = "a".repeat(64);

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

describe("purgeProxyKeyCache", () => {
  it("is a no-op when the worker admin endpoint is not configured", async () => {
    vi.stubEnv("PROXY_ADMIN_URL", "");
    vi.stubEnv("PROXY_PURGE_SECRET", "");
    const fetchFn = stubFetch();

    await purgeProxyKeyCache(HASH);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("posts the hash with the bearer secret when configured", async () => {
    vi.stubEnv("PROXY_ADMIN_URL", "https://proxy.test");
    vi.stubEnv("PROXY_PURGE_SECRET", "shh");
    const fetchFn = stubFetch();

    await purgeProxyKeyCache(HASH);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe("https://proxy.test/admin/purge");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer shh");
    expect(JSON.parse(String(init?.body))).toEqual({ keyHash: HASH });
  });

  it("swallows network errors", async () => {
    vi.stubEnv("PROXY_ADMIN_URL", "https://proxy.test");
    vi.stubEnv("PROXY_PURGE_SECRET", "shh");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    await expect(purgeProxyKeyCache(HASH)).resolves.toBeUndefined();
  });
});
