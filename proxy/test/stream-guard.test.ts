import { describe, expect, it } from "vitest";
import { streamWithCount } from "../src/proxy/forward";
import {
  BudgetMeter,
  detectFormat,
  guardApplies,
  terminalFrame,
} from "../src/proxy/stream-guard";

const enc = (s: string) => new TextEncoder().encode(s);

/** Build a streaming Response from a list of SSE frames. */
function sseResponse(frames: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const f of frames) controller.enqueue(enc(f));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

async function readAll(res: Response): Promise<string> {
  return await res.text();
}

describe("guardApplies", () => {
  it("only activates for per-token billing with a finite positive balance", () => {
    expect(guardApplies("per_token", 5)).toBe(true);
    expect(guardApplies("flat", 5)).toBe(false);
    expect(guardApplies("per_token", null)).toBe(false);
    expect(guardApplies("per_token", 0)).toBe(false);
    expect(guardApplies("per_token", Infinity)).toBe(false);
  });
});

describe("detectFormat", () => {
  it("sniffs provider style and is sticky once known", () => {
    expect(detectFormat('data: {"choices":[{}]}', "unknown")).toBe("openai");
    expect(detectFormat('{"type":"content_block_delta"}', "unknown")).toBe("anthropic");
    expect(detectFormat("plain text", "unknown")).toBe("unknown");
    expect(detectFormat('{"choices":1}', "anthropic")).toBe("anthropic"); // sticky
  });
});

describe("terminalFrame", () => {
  it("emits a valid OpenAI length-stop + [DONE]", () => {
    const f = terminalFrame("openai", 100);
    expect(f).toContain('"finish_reason":"length"');
    expect(f).toContain("[DONE]");
  });
  it("emits an Anthropic message_delta + message_stop", () => {
    const f = terminalFrame("anthropic", 42);
    expect(f).toContain('"stop_reason":"max_tokens"');
    expect(f).toContain('"output_tokens":42');
    expect(f).toContain("message_stop");
  });
  it("emits nothing for unknown formats", () => {
    expect(terminalFrame("unknown", 1)).toBe("");
  });
});

describe("BudgetMeter", () => {
  it("prefers reported completion tokens over the byte estimate", () => {
    const m = new BudgetMeter({ inputTokenCost: 0, outputTokenCost: 0.01, balanceRemaining: 1 });
    m.noteBytes(4000); // estimate would say 1000 tokens
    m.noteUsage(null, 10); // provider says 10
    expect(m.outputTokens()).toBe(10);
    expect(m.runningCost()).toBeCloseTo(0.1);
    expect(m.exceeds()).toBe(false);
  });
  it("falls back to a conservative bytes/4 estimate without reported usage", () => {
    const m = new BudgetMeter({ inputTokenCost: 0, outputTokenCost: 0.01, balanceRemaining: 1 });
    m.noteBytes(800); // ~200 tokens
    expect(m.outputTokens()).toBe(200);
    expect(m.exceeds()).toBe(true); // 200 * 0.01 = 2 >= 1
  });
});

describe("streamWithCount mid-stream guard (integration)", () => {
  it("passes a well-funded stream through untouched", async () => {
    const frames = [
      'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":3}}\n\n',
      "data: [DONE]\n\n",
    ];
    const { response, done } = streamWithCount(sseResponse(frames), {
      inputTokenCost: 0,
      outputTokenCost: 0.000001,
      balanceRemaining: 100,
    });
    const text = await readAll(response);
    const result = await done;
    expect(text).toBe(frames.join(""));
    expect(result.stoppedForBudget).toBe(false);
  });

  it("injects a clean OpenAI terminal frame when the cap is crossed mid-stream", async () => {
    // Each content frame is ~400 bytes → ~100 est tokens; outputCost 0.01;
    // balance 1.5 → boundary after the 2nd frame (~$2 > $1.5).
    const big = "x".repeat(380);
    const frames = [
      `data: {"choices":[{"delta":{"content":"${big}"}}]}\n\n`,
      `data: {"choices":[{"delta":{"content":"${big}"}}]}\n\n`,
      `data: {"choices":[{"delta":{"content":"${big}"}}]}\n\n`,
      "data: [DONE]\n\n",
    ];
    const { response, done } = streamWithCount(sseResponse(frames), {
      inputTokenCost: 0,
      outputTokenCost: 0.01,
      balanceRemaining: 1.5,
    });
    const text = await readAll(response);
    const result = await done;
    expect(result.stoppedForBudget).toBe(true);
    expect(text).toContain('"finish_reason":"length"');
    expect(text).toContain("[DONE]");
    // It stopped early: the 3rd content frame never made it through.
    expect(text.split(big).length - 1).toBeLessThan(3);
  });
});
