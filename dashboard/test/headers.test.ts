import { describe, expect, it } from "vitest";
import { parseHeaders } from "@/lib/headers";

describe("parseHeaders", () => {
  it("parses a single header", () => {
    expect(parseHeaders("Authorization: Bearer sk-123")).toEqual({
      Authorization: "Bearer sk-123",
    });
  });

  it("parses multiple headers across lines", () => {
    expect(
      parseHeaders("Authorization: Bearer sk-1\nOpenAI-Organization: org-2"),
    ).toEqual({
      Authorization: "Bearer sk-1",
      "OpenAI-Organization": "org-2",
    });
  });

  it("keeps colons inside the value (e.g. URLs)", () => {
    expect(parseHeaders("X-Base: https://api.example.com")).toEqual({
      "X-Base": "https://api.example.com",
    });
  });

  it("ignores blank lines", () => {
    expect(parseHeaders("\n\nAuthorization: Bearer x\n\n")).toEqual({
      Authorization: "Bearer x",
    });
  });

  it("returns null for a line with no colon", () => {
    expect(parseHeaders("Authorization Bearer x")).toBeNull();
  });

  it("returns null for an empty header name", () => {
    expect(parseHeaders(": value")).toBeNull();
  });

  it("returns null for an empty value", () => {
    expect(parseHeaders("Authorization:   ")).toBeNull();
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(parseHeaders("")).toBeNull();
    expect(parseHeaders("   \n  ")).toBeNull();
  });
});
