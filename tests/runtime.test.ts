import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { promptUrl, request } from "../src/runtime/client.js";
import { configurePrompt, getPromptConfig, resetPromptConfig } from "../src/runtime/config.js";
import {
  createFaAuthAdapter,
  createInMemoryAuthAdapter,
  defaultIsSuperuser,
  getPromptAuthAdapter,
  resetPromptAuthAdapter,
  setPromptAuthAdapter,
  type PromptAuthAdapter
} from "../src/runtime/authAdapter.js";
import {
  ApiError,
  ForbiddenError,
  messageFromDetail,
  normalizeFastApiError,
  UnauthenticatedError
} from "../src/runtime/errors.js";

const okSchema = z.object({ ok: z.boolean() });

function makeResponse(
  status: number,
  body: unknown,
  opts: { jsonThrows?: boolean; text?: string } = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    clone() {
      return this;
    },
    async json() {
      if (opts.jsonThrows) throw new Error("not json");
      return body;
    },
    async text() {
      return opts.text ?? (typeof body === "string" ? body : JSON.stringify(body));
    }
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  resetPromptConfig();
  resetPromptAuthAdapter();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("config", () => {
  it("merges partial config, and resets", () => {
    const updated = configurePrompt({ apiBase: "/p" });
    expect(updated.apiBase).toBe("/p");
    expect(updated.apiPrefix).toBe("/fastapi");
    configurePrompt();
    expect(getPromptConfig().apiBase).toBe("/p");
    resetPromptConfig();
    expect(getPromptConfig().apiBase).toBe("/prompt");
  });
});

describe("errors", () => {
  it("derives messages from details", () => {
    expect(messageFromDetail("boom")).toBe("boom");
    expect(messageFromDetail("   ")).toBeUndefined();
    expect(messageFromDetail([{ msg: "a" }, { msg: "b" }, { nope: 1 }])).toBe("a; b");
    expect(messageFromDetail([{ nope: 1 }])).toBeUndefined();
    expect(messageFromDetail({ x: 1 })).toBeUndefined();
    expect(new ApiError(500, {}).message).toBe("Prompt API request failed");
    expect(new UnauthenticatedError().message).toBe("Authentication required");
    expect(new ForbiddenError().status).toBe(403);
  });

  it("normalizes FastAPI error bodies", () => {
    expect(normalizeFastApiError({ detail: "x" })).toBe("x");
    expect(normalizeFastApiError("raw")).toBe("raw");
  });
});

describe("auth adapter", () => {
  it("default in-memory adapter holds token in memory", async () => {
    const adapter = createInMemoryAuthAdapter("t0");
    expect(await adapter.getAccessToken()).toBe("t0");
    adapter.setAccessToken("t1");
    expect(await adapter.getAccessToken()).toBe("t1");
    expect(adapter.isSuperuser?.({ is_superuser: true })).toBe(true);
  });

  it("defaultIsSuperuser honours flag, role and roles array", () => {
    expect(defaultIsSuperuser(null)).toBe(false);
    expect(defaultIsSuperuser({ is_superuser: true })).toBe(true);
    expect(defaultIsSuperuser({ role: "admin" }, "admin")).toBe(true);
    expect(defaultIsSuperuser({ roles: ["admin"] }, "admin")).toBe(true);
    expect(defaultIsSuperuser({ role: "user" }, "admin")).toBe(false);
    expect(defaultIsSuperuser({ is_superuser: false })).toBe(false);
  });

  it("fa-auth adapter maps bindings (string and object refresh, fallbacks)", async () => {
    const onUnauthenticated = vi.fn();
    const a = createFaAuthAdapter({
      getToken: () => "tok",
      refreshToken: async () => ({ access_token: "fresh" }),
      getUser: () => ({ is_superuser: true }),
      hasRole: (role) => role === "admin",
      onUnauthenticated
    });
    expect(a.getAccessToken()).toBe("tok");
    expect(await a.refresh?.()).toBe("fresh");
    expect(a.isSuperuser?.({ is_superuser: true })).toBe(true);
    expect(a.hasRole?.("admin")).toBe(true);

    const stringRefresh = createFaAuthAdapter({
      getToken: () => null,
      refreshToken: async () => "plain"
    });
    expect(await stringRefresh.refresh?.()).toBe("plain");

    const nullRefresh = createFaAuthAdapter({
      getToken: () => null,
      refreshToken: async () => null
    });
    expect(await nullRefresh.refresh?.()).toBeNull();

    const objNoToken = createFaAuthAdapter({
      getToken: () => null,
      refreshToken: async () => ({})
    });
    expect(await objNoToken.refresh?.()).toBeNull();

    const noRefresh = createFaAuthAdapter({ getToken: () => null });
    expect(await noRefresh.refresh?.()).toBeNull();
    expect(noRefresh.isSuperuser?.({ is_superuser: true })).toBe(true);

    // explicit isSuperuser binding is used verbatim
    const withSuper = createFaAuthAdapter({ getToken: () => null, isSuperuser: () => false });
    expect(withSuper.isSuperuser?.({ is_superuser: true })).toBe(false);
  });

  it("get/set/reset the active adapter", () => {
    const custom = createInMemoryAuthAdapter("z");
    expect(setPromptAuthAdapter(custom)).toBe(custom);
    expect(getPromptAuthAdapter()).toBe(custom);
    resetPromptAuthAdapter();
    expect(getPromptAuthAdapter()).not.toBe(custom);
  });
});

describe("promptUrl", () => {
  it("resolves api and absolute bases", () => {
    configurePrompt({ apiBase: "/prompt", apiPrefix: "/fastapi" });
    expect(promptUrl("api", "/prompt-block/")).toBe(
      "http://localhost/prompt/fastapi/prompt-block/"
    );
    expect(promptUrl("absolute", "https://prompt.test/x")).toBe("https://prompt.test/x");
  });

  it("rejects unsupported protocols", () => {
    expect(() => promptUrl("absolute", "javascript:alert(1)")).toThrow(
      "Unsupported prompt API protocol"
    );
  });

  it("uses window.location.origin in the browser", () => {
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    expect(promptUrl("api", "/x")).toBe("https://app.test/prompt/fastapi/x");
  });
});

describe("request", () => {
  it("performs an authed GET, attaches bearer and parses the body", async () => {
    setPromptAuthAdapter(createInMemoryAuthAdapter("abc"));
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const result = await request({ method: "GET", path: "/x", schema: okSchema, auth: true });
    expect(result).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer abc");
    expect(init.credentials).toBe("include");
  });

  it("omits the bearer when no token and supports query + custom headers", async () => {
    setPromptAuthAdapter(createInMemoryAuthAdapter(null));
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({
      method: "GET",
      path: "/x",
      schema: okSchema,
      auth: true,
      headers: { "X-Test": "1" },
      query: { a: 1, b: null, c: undefined, d: false }
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("a=1");
    expect(url).toContain("d=false");
    expect(url).not.toContain("b=");
    expect((init.headers as Headers).get("Authorization")).toBeNull();
    expect((init.headers as Headers).get("X-Test")).toBe("1");
  });

  it("sends a JSON body on writes", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({ method: "POST", path: "/x", body: { a: 1 }, schema: okSchema });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("returns undefined for 204 and when no schema is given", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(204, null));
    expect(await request({ method: "DELETE", path: "/x" })).toBeUndefined();
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    expect(await request({ method: "POST", path: "/x" })).toBeUndefined();
  });

  it("guards admin calls before the network for a known non-superuser", async () => {
    setPromptAuthAdapter({
      getAccessToken: () => "t",
      getUser: () => ({ is_superuser: false }),
      isSuperuser: () => false
    });
    await expect(
      request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows admin calls when the user is a superuser or unknown", async () => {
    setPromptAuthAdapter({
      getAccessToken: () => "t",
      getUser: () => ({ is_superuser: true }),
      isSuperuser: () => true
    });
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true });

    setPromptAuthAdapter({
      getAccessToken: () => "t",
      getUser: () => null,
      isSuperuser: () => false
    });
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true });

    // adapter without getUser/isSuperuser skips the guard entirely
    setPromptAuthAdapter({ getAccessToken: () => "t" });
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes once on 401 then retries with the new token", async () => {
    const refresh = vi.fn().mockResolvedValue("fresh");
    setPromptAuthAdapter({ getAccessToken: () => "stale", refresh });
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { detail: "expired" }))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const result = await request({ method: "GET", path: "/x", schema: okSchema, auth: true });
    expect(result).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledOnce();
    const [, retryInit] = fetchMock.mock.calls[1];
    expect((retryInit.headers as Headers).get("Authorization")).toBe("Bearer fresh");
  });

  it("throws UnauthenticatedError when refresh yields nothing (with onUnauthenticated)", async () => {
    const onUnauthenticated = vi.fn();
    setPromptAuthAdapter({
      getAccessToken: () => "stale",
      refresh: async () => null,
      onUnauthenticated
    });
    fetchMock.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(
      request({ method: "GET", path: "/x", schema: okSchema, auth: true })
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(onUnauthenticated).toHaveBeenCalledWith("refresh-failed");
  });

  it("throws UnauthenticatedError when no refresh is available (no onUnauthenticated)", async () => {
    setPromptAuthAdapter({ getAccessToken: () => null });
    fetchMock.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(
      request({ method: "GET", path: "/x", schema: okSchema, auth: true })
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("with skipRefresh, surfaces a 401 as UnauthenticatedError", async () => {
    const onUnauthenticated = vi.fn();
    setPromptAuthAdapter({ getAccessToken: () => "t", onUnauthenticated });
    fetchMock.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(
      request({ method: "GET", path: "/x", schema: okSchema, auth: true, skipRefresh: true })
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(onUnauthenticated).toHaveBeenCalledWith("unauthenticated");

    // again without onUnauthenticated to cover the optional-chain false branch
    setPromptAuthAdapter({ getAccessToken: () => "t" });
    fetchMock.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(
      request({ method: "GET", path: "/x", schema: okSchema, auth: true, skipRefresh: true })
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("maps a JSON error body to ApiError", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(500, { detail: "boom" }));
    await expect(request({ method: "GET", path: "/x", schema: okSchema })).rejects.toMatchObject({
      status: 500,
      detail: "boom"
    });
  });

  it("falls back to text when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(502, null, { jsonThrows: true, text: "gateway" }));
    await expect(request({ method: "GET", path: "/x", schema: okSchema })).rejects.toMatchObject({
      status: 502,
      detail: "gateway"
    });
  });

  it("maps a 403 on an admin call to ForbiddenError with the server message", async () => {
    setPromptAuthAdapter({ getAccessToken: () => "t" });
    fetchMock.mockResolvedValueOnce(makeResponse(403, { detail: "Not enough permissions" }));
    await expect(
      request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true })
    ).rejects.toMatchObject({ name: "ForbiddenError", message: "Not enough permissions" });
  });

  it("maps a 403 on a non-admin call to ApiError", async () => {
    setPromptAuthAdapter({ getAccessToken: () => "t" });
    fetchMock.mockResolvedValueOnce(makeResponse(403, { detail: "no" }));
    await expect(
      request({ method: "GET", path: "/x", schema: okSchema, auth: true, admin: false })
    ).rejects.toMatchObject({ name: "ApiError", status: 403 });
  });
});