import { describe, expect, it, vi } from "vitest";
import { appOrigin } from "@/lib/app-url";
import {
  formatInt,
  formatShortDate,
  formatSignedUsd,
  formatTimestamp,
  formatUsd,
} from "@/lib/format";

describe("formatUsd", () => {
  it("formats whole and sub-cent amounts", () => {
    expect(formatUsd(0.01)).toBe("$0.01");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(0.000001)).toBe("$0.000001");
    expect(formatUsd(0)).toBe("$0.00");
  });
});

describe("formatSignedUsd", () => {
  it("prefixes a sign by direction", () => {
    expect(formatSignedUsd(5)).toBe("+$5.00");
    expect(formatSignedUsd(-0.01)).toBe("-$0.01");
  });
});

describe("formatShortDate", () => {
  it("is deterministic (en-US, UTC) regardless of viewer locale", () => {
    expect(formatShortDate("2026-06-11T23:59:00Z")).toBe("Jun 11");
    expect(formatShortDate("2026-01-01T00:00:00Z")).toBe("Jan 1");
  });
  it("returns a dash for invalid input", () => {
    expect(formatShortDate("garbage")).toBe("—");
  });
});

describe("formatInt", () => {
  it("uses en-US thousands separators", () => {
    expect(formatInt(5000)).toBe("5,000");
    expect(formatInt(0)).toBe("0");
    expect(formatInt(1234567.9)).toBe("1,234,568");
  });
});

describe("appOrigin", () => {
  it("prefers NEXT_PUBLIC_APP_URL when set", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://example.test";
    expect(appOrigin()).toBe("https://example.test");
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prev;
  });
  it("never falls back to localhost in production", () => {
    const prevUrl = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const prevEnv = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    expect(appOrigin()).toBe("https://getallowance.dev");
    vi.stubEnv("NODE_ENV", prevEnv ?? "test");
    if (prevUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = prevUrl;
  });
});

describe("formatTimestamp", () => {
  it("renders a UTC minute-precision stamp", () => {
    expect(formatTimestamp("2026-06-07T14:05:30Z")).toBe("2026-06-07 14:05 UTC");
  });
  it("returns a dash for invalid input", () => {
    expect(formatTimestamp("not-a-date")).toBe("—");
  });
});
