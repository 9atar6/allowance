import { describe, expect, it } from "vitest";
import { formatSignedUsd, formatTimestamp, formatUsd } from "@/lib/format";

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

describe("formatTimestamp", () => {
  it("renders a UTC minute-precision stamp", () => {
    expect(formatTimestamp("2026-06-07T14:05:30Z")).toBe("2026-06-07 14:05 UTC");
  });
  it("returns a dash for invalid input", () => {
    expect(formatTimestamp("not-a-date")).toBe("—");
  });
});
