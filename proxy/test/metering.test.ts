import { describe, expect, it } from "vitest";
import { computeCost } from "../src/proxy/cost";
import { UsageExtractor } from "../src/proxy/usage-meter";
import type { ResolvedContext } from "../src/types";

const enc = (s: string) => new TextEncoder().encode(s);

function feed(chunks: string[]): UsageExtractor {
  const m = new UsageExtractor();
  for (const c of chunks) m.push(enc(c));
  m.end();
  return m;
}

describe("UsageExtractor", () => {
  it("extracts usage from an OpenAI-style SSE stream", () => {
    const m = feed([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":8}}\n\n',
      "data: [DONE]\n\n",
    ]);
    expect(m.result()).toEqual({ promptTokens: 12, completionTokens: 8 });
  });

  it("handles a usage frame split across chunk boundaries", () => {
    const m = feed([
      'data: {"usage":{"prompt_to',
      'kens":3,"completion_tokens":5}}\n\n',
    ]);
    expect(m.result()).toEqual({ promptTokens: 3, completionTokens: 5 });
  });

  it("parses usage from a non-streaming JSON body", () => {
    const m = feed(['{"id":"x","usage":{"prompt_tokens":100,"completion_tokens":50}}']);
    expect(m.result()).toEqual({ promptTokens: 100, completionTokens: 50 });
  });

  it("returns null when no usage is present", () => {
    const m = feed(['data: {"choices":[{"delta":{"content":"hi"}}]}\n\n', "data: [DONE]\n\n"]);
    expect(m.result()).toBeNull();
  });

  it("ignores malformed frames without throwing", () => {
    const m = feed(["data: not-json\n\n", "data: {bad\n\n"]);
    expect(m.result()).toBeNull();
  });
});

function ctx(over: Partial<ResolvedContext>): ResolvedContext {
  return {
    userId: "u",
    balance: 10,
    endpointId: "e",
    targetUrl: "https://x/v1",
    costPerRequest: 0.01,
    meteringMode: "flat",
    inputTokenCost: 0,
    outputTokenCost: 0,
    endpointActive: true,
    upstreamHeaders: {},
    keyHash: "h",
    ...over,
  };
}

describe("computeCost", () => {
  it("returns the flat fee in flat mode", () => {
    expect(computeCost(ctx({ meteringMode: "flat" }), { promptTokens: 100, completionTokens: 100 })).toBe(0.01);
  });

  it("bills prompt + completion tokens in per_token mode", () => {
    const cost = computeCost(
      ctx({ meteringMode: "per_token", inputTokenCost: 0.000001, outputTokenCost: 0.000002 }),
      { promptTokens: 1000, completionTokens: 500 },
    );
    expect(cost).toBeCloseTo(1000 * 0.000001 + 500 * 0.000002, 12); // 0.002
  });

  it("falls back to the flat fee when per_token has no usage", () => {
    expect(
      computeCost(ctx({ meteringMode: "per_token", inputTokenCost: 0.001 }), null),
    ).toBe(0.01);
  });
});
