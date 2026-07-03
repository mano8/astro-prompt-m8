import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../src/runtime/client.js", () => ({ request: requestMock }));

import { createInternalPromptClient } from "../src/runtime/api/internal.server.js";

const ENV = "PROMPT_INTERNAL_SERVICE_TOKEN";

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({});
  delete process.env[ENV];
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env[ENV];
  delete process.env.CUSTOM_TOKEN;
});

describe("internal server client", () => {
  it("refuses to load in a browser context", () => {
    vi.stubGlobal("window", {});
    expect(() => createInternalPromptClient({ token: "t" })).toThrow(/server/);
  });

  it("requires a service token from the environment", () => {
    expect(() => createInternalPromptClient()).toThrow(/PROMPT_INTERNAL_SERVICE_TOKEN/);
  });

  it("reads the default env var", () => {
    process.env[ENV] = "env-token";
    expect(() => createInternalPromptClient()).not.toThrow();
  });

  it("reads a custom env var", () => {
    process.env.CUSTOM_TOKEN = "custom";
    expect(() => createInternalPromptClient({ serviceTokenEnv: "CUSTOM_TOKEN" })).not.toThrow();
  });

  it("attaches the service token and calls the internal ping endpoint", async () => {
    const client = createInternalPromptClient({ token: "svc" });
    const result = await client.ping();
    expect(result).toEqual({ ok: true });
    const [opts] = requestMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer svc");
    expect(opts.skipRefresh).toBe(true);
  });
});