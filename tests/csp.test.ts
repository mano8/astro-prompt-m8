import { describe, expect, it } from "vitest";
import {
  buildPromptConnectSrc,
  buildPromptCspPolicy,
  originOf
} from "../src/lib/csp.js";

describe("originOf", () => {
  it("extracts the origin from an absolute URL", () => {
    expect(originOf("https://prompt.example.com/prompt")).toBe("https://prompt.example.com");
    expect(originOf("https://prompt.example.com:8443/prompt/fastapi/")).toBe(
      "https://prompt.example.com:8443"
    );
  });

  it("returns null for a relative path", () => {
    expect(originOf("/prompt")).toBeNull();
    expect(originOf("prompt")).toBeNull();
    expect(originOf("")).toBeNull();
  });
});

describe("buildPromptConnectSrc", () => {
  it("returns self-only for a relative apiBase", () => {
    expect(buildPromptConnectSrc("/prompt")).toBe("'self'");
  });

  it("includes the api origin and dedupes for an absolute apiBase", () => {
    const value = buildPromptConnectSrc("https://prompt.example.com", []);
    expect(value.split(" ")).toEqual(expect.arrayContaining(["'self'", "https://prompt.example.com"]));
  });

  it("forwards extra origins and ignores invalid ones", () => {
    const value = buildPromptConnectSrc("/prompt", [
      "https://auth.example.com",
      "not-a-url"
    ]);
    expect(value).toContain("https://auth.example.com");
    expect(value).toContain("'self'");
    expect(value).not.toContain("not-a-url");
  });
});

describe("buildPromptCspPolicy", () => {
  it("emits the full directive set by default", () => {
    const policy = buildPromptCspPolicy("/prompt");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("img-src 'self' data: blob: https:");
  });

  it("includes the service origin and extra origins in connect-src", () => {
    const policy = buildPromptCspPolicy("/prompt", {
      serviceOrigin: "https://prompt.example.com",
      connectExtraOrigins: ["https://auth.example.com"]
    });
    expect(policy).toContain("https://prompt.example.com");
    expect(policy).toContain("https://auth.example.com");
  });
});