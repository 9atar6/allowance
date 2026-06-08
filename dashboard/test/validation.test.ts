import { describe, expect, it } from "vitest";
import { endpointSchema, topUpSchema } from "@/lib/validation";

describe("endpointSchema", () => {
  const valid = {
    name: "OpenAI",
    targetUrl: "https://api.openai.com/v1",
    costPerRequest: "0.01",
    headers: "Authorization: Bearer sk-x",
  };

  it("accepts a valid endpoint and coerces cost to a number", () => {
    const res = endpointSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.costPerRequest).toBe(0.01);
  });

  it("rejects a non-https target URL", () => {
    const res = endpointSchema.safeParse({ ...valid, targetUrl: "http://api.openai.com" });
    expect(res.success).toBe(false);
  });

  it("rejects a non-positive cost", () => {
    expect(endpointSchema.safeParse({ ...valid, costPerRequest: "0" }).success).toBe(false);
    expect(endpointSchema.safeParse({ ...valid, costPerRequest: "-1" }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(endpointSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("defaults to flat metering", () => {
    const res = endpointSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.meteringMode).toBe("flat");
  });

  it("accepts per_token with a token price", () => {
    const res = endpointSchema.safeParse({
      ...valid,
      meteringMode: "per_token",
      inputTokenCost: "0.000001",
      outputTokenCost: "0.000002",
    });
    expect(res.success).toBe(true);
  });

  it("rejects per_token with no token price", () => {
    const res = endpointSchema.safeParse({
      ...valid,
      meteringMode: "per_token",
      inputTokenCost: "0",
      outputTokenCost: "0",
    });
    expect(res.success).toBe(false);
  });
});

describe("topUpSchema", () => {
  it("accepts an amount within bounds", () => {
    const res = topUpSchema.safeParse({ amount: "25" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.amount).toBe(25);
  });

  it("rejects below the $5 minimum", () => {
    expect(topUpSchema.safeParse({ amount: "4" }).success).toBe(false);
  });

  it("rejects above the $10,000 maximum", () => {
    expect(topUpSchema.safeParse({ amount: "10001" }).success).toBe(false);
  });
});
