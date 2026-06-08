import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateProxyKey } from "@/lib/keys";

describe("generateProxyKey", () => {
  it("returns a key with the configured prefix", () => {
    const { key } = generateProxyKey();
    expect(key.startsWith("alw_live_")).toBe(true);
  });

  it("stores only the SHA-256 hash of the full key", () => {
    const { key, keyHash } = generateProxyKey();
    const expected = createHash("sha256").update(key).digest("hex");
    expect(keyHash).toBe(expected);
    // The hash must not be derivable from the prefix alone.
    expect(keyHash).not.toContain(key);
  });

  it("exposes a non-secret display prefix shorter than the full key", () => {
    const { key, keyPrefix } = generateProxyKey();
    expect(key.startsWith(keyPrefix)).toBe(true);
    expect(keyPrefix.length).toBeLessThan(key.length);
  });

  it("generates unique keys", () => {
    const a = generateProxyKey();
    const b = generateProxyKey();
    expect(a.key).not.toBe(b.key);
    expect(a.keyHash).not.toBe(b.keyHash);
  });
});
