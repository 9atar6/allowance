import { describe, expect, it } from "vitest";
import { computeCost } from "../src/proxy/cost";
import { UsageExtractor } from "../src/proxy/usage-meter";
import type { ActiveRequest } from "../src/types";

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

  it("extracts Anthropic usage split across message_start and message_delta", () => {
    // Anthropic streaming: input_tokens arrive in message_start (nested under
    // message.usage), final output_tokens in message_delta. Must merge.
    const m = feed([
      'data: {"type":"message_start","message":{"id":"m1","usage":{"input_tokens":25,"output_tokens":1}}}\n\n',
      'data: {"type":"content_block_delta","delta":{"text":"hi"}}\n\n',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":90}}\n\n',
    ]);
    expect(m.result()).toEqual({ promptTokens: 25, completionTokens: 90 });
  });

  it("parses Anthropic usage from a non-streaming JSON body", () => {
    const m = feed(['{"id":"m1","usage":{"input_tokens":40,"output_tokens":12}}']);
    expect(m.result()).toEqual({ promptTokens: 40, completionTokens: 12 });
  });

  it("parses Gemini usageMetadata (streaming, last cumulative frame wins)", () => {
    const m = feed([
      'data: {"candidates":[{"content":{}}],"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":3}}\n\n',
      'data: {"candidates":[{"content":{}}],"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":21,"totalTokenCount":28}}\n\n',
    ]);
    expect(m.result()).toEqual({ promptTokens: 7, completionTokens: 21 });
  });

  it("parses Gemini usageMetadata from a non-streaming JSON body", () => {
    const m = feed([
      '{"candidates":[],"usageMetadata":{"promptTokenCount":11,"candidatesTokenCount":4,"totalTokenCount":15}}',
    ]);
    expect(m.result()).toEqual({ promptTokens: 11, completionTokens: 4 });
  });

  it("returns null when only one side was ever seen", () => {
    // A lone message_delta with output_tokens but no input_tokens must not
    // fabricate a usage object with a missing half.
    const m = feed(['data: {"type":"message_delta","usage":{"output_tokens":9}}\n\n']);
    expect(m.result()).toBeNull();
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

function ctx(over: Partial<ActiveRequest>): ActiveRequest {
  return {
    userId: "u",
    keyHash: "h",
    balance: 10,
    endpointId: "e",
    targetUrl: "https://x/v1",
    costPerRequest: 0.01,
    meteringMode: "flat",
    inputTokenCost: 0,
    outputTokenCost: 0,
    upstreamHeaders: {},
    proxyPrefix: "/v1/proxy",
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
