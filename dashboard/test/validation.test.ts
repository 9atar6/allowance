import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  attachServiceSchema,
  connectionSchema,
  isPublicHttpsUrl,
  projectSchema,
} from "@/lib/validation";

describe("isPublicHttpsUrl (SSRF guard)", () => {
  it("allows a public https URL", () => {
    expect(isPublicHttpsUrl("https://api.openai.com/v1")).toBe(true);
  });
  it("blocks plain http", () => {
    expect(isPublicHttpsUrl("http://api.openai.com")).toBe(false);
  });
  it("blocks localhost and loopback", () => {
    expect(isPublicHttpsUrl("https://localhost")).toBe(false);
    expect(isPublicHttpsUrl("https://127.0.0.1")).toBe(false);
  });
  it("blocks private ranges", () => {
    expect(isPublicHttpsUrl("https://10.0.0.5")).toBe(false);
    expect(isPublicHttpsUrl("https://192.168.1.1")).toBe(false);
    expect(isPublicHttpsUrl("https://172.16.0.1")).toBe(false);
  });
  it("blocks link-local / cloud metadata", () => {
    expect(isPublicHttpsUrl("https://169.254.169.254/latest/meta-data")).toBe(
      false,
    );
  });
  it("rejects garbage", () => {
    expect(isPublicHttpsUrl("not a url")).toBe(false);
  });
  it("blocks IPv6 unique-local literals but not fc*/fd* domains", () => {
    expect(isPublicHttpsUrl("https://[fc00::1]")).toBe(false);
    expect(isPublicHttpsUrl("https://[fd12:3456::1]")).toBe(false);
    expect(isPublicHttpsUrl("https://fcc.gov")).toBe(true);
    expect(isPublicHttpsUrl("https://fdic.gov")).toBe(true);
  });
});

describe("connectionSchema", () => {
  const valid = {
    name: "OpenAI",
    targetUrl: "https://api.openai.com/v1",
    costPerRequest: "0.01",
    headers: "Authorization: Bearer sk-x",
  };

  it("accepts a valid connection and coerces cost to a number", () => {
    const res = connectionSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.costPerRequest).toBe(0.01);
  });
  it("defaults to flat metering", () => {
    const res = connectionSchema.safeParse(valid);
    if (res.success) expect(res.data.meteringMode).toBe("flat");
  });
  it("rejects a private / SSRF URL", () => {
    const res = connectionSchema.safeParse({ ...valid, targetUrl: "https://127.0.0.1" });
    expect(res.success).toBe(false);
  });
  it("rejects an empty name", () => {
    const res = connectionSchema.safeParse({ ...valid, name: "" });
    expect(res.success).toBe(false);
  });
});

describe("attachServiceSchema", () => {
  it("accepts a valid slug", () => {
    const res = attachServiceSchema.safeParse({
      projectId: randomUUID(),
      endpointId: randomUUID(),
      slug: "openai-v1",
    });
    expect(res.success).toBe(true);
  });
  it("rejects an invalid slug", () => {
    const res = attachServiceSchema.safeParse({
      projectId: randomUUID(),
      endpointId: randomUUID(),
      slug: "Bad Slug!",
    });
    expect(res.success).toBe(false);
  });
  it("rejects a non-uuid project id", () => {
    const res = attachServiceSchema.safeParse({
      projectId: "nope",
      endpointId: randomUUID(),
      slug: "ok",
    });
    expect(res.success).toBe(false);
  });
});

describe("projectSchema", () => {
  it("accepts a name with an optional budget", () => {
    expect(
      projectSchema.safeParse({ name: "My SaaS", monthlyBudget: "10" }).success,
    ).toBe(true);
  });
  it("treats a blank budget as absent", () => {
    const res = projectSchema.safeParse({ name: "My SaaS", monthlyBudget: "" });
    expect(res.success).toBe(true);
  });
});
