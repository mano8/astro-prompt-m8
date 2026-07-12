import { describe, expect, it, vi } from "vitest";
import faPrompt, { buildPromptRoutes } from "../src/integration.js";
import { promptRedirect, routeForLocale } from "../src/runtime/routes.js";
import { onRequest } from "../src/middleware.js";

type SetupCtx = { config?: { integrations?: { name?: string }[] } };

function runSetup(options: Parameters<typeof faPrompt>[0] = {}, ctx: SetupCtx = {}) {
  const integration = faPrompt(options);
  const injectRoute = vi.fn();
  const addMiddleware = vi.fn();
  const updateConfig = vi.fn();
  const logger = { warn: vi.fn() };
  const hook = integration.hooks["astro:config:setup"] as (params: unknown) => void;
  hook({ injectRoute, addMiddleware, updateConfig, logger, config: ctx.config });
  return { injectRoute, addMiddleware, updateConfig, logger };
}

describe("buildPromptRoutes", () => {
  it("builds default routes", () => {
    expect(buildPromptRoutes()).toEqual({
      blocks: "/prompt/blocks",
      templates: "/prompt/templates",
      composer: "/prompt/composer",
      admin: "/admin/prompts"
    });
  });

  it("honours a base prefix and disabled routes", () => {
    const routes = buildPromptRoutes({ base: "/[locale]", admin: false, blocks: "/" });
    expect(routes.templates).toBe("/[locale]/prompt/templates");
    expect(routes.admin).toBeUndefined();
    expect(routes.blocks).toBe("/[locale]");
  });

  it("disables every route", () => {
    expect(
      buildPromptRoutes({
        blocks: false,
        templates: false,
        composer: false,
        admin: false
      })
    ).toEqual({
      blocks: undefined,
      templates: undefined,
      composer: undefined,
      admin: undefined
    });
  });

  it("defaults the base when explicitly undefined", () => {
    expect(buildPromptRoutes({ base: undefined, blocks: "/" }).blocks).toBe("/");
  });
});

describe("route helpers", () => {
  it("resolves locale patterns", () => {
    expect(routeForLocale("/[locale]/prompt", "en")).toBe("/en/prompt");
    expect(routeForLocale("/:locale/prompt")).toBe("/prompt");
  });

  it("redirects to a route or falls back to root", () => {
    const routes = buildPromptRoutes({ base: "/[locale]" });
    expect(promptRedirect(routes, "blocks", "es")).toBe("/es/prompt/blocks");
    expect(promptRedirect({ admin: undefined }, "admin")).toBe("/");
  });
});

describe("faPrompt integration", () => {
  it("is headless by default: defines env, injects nothing", () => {
    const { injectRoute, addMiddleware, updateConfig, logger } = runSetup();
    expect(injectRoute).not.toHaveBeenCalled();
    expect(addMiddleware).not.toHaveBeenCalled();
    const define = updateConfig.mock.calls[0][0].vite.define;
    expect(define["import.meta.env.PUBLIC_FA_PROMPT_API_BASE"]).toBe(JSON.stringify("/prompt"));
    expect(define["import.meta.env.PUBLIC_FA_PROMPT_API_PREFIX"]).toBe(JSON.stringify("/fastapi"));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("uses explicit base values when supplied", () => {
    const { updateConfig } = runSetup({
      apiBase: "/p",
      apiPrefix: "/api",
      auth: { adminRole: "admin" }
    });
    const define = updateConfig.mock.calls[0][0].vite.define;
    expect(define["import.meta.env.PUBLIC_FA_PROMPT_API_BASE"]).toBe(JSON.stringify("/p"));
    expect(define["import.meta.env.PUBLIC_FA_PROMPT_API_PREFIX"]).toBe(JSON.stringify("/api"));
    expect(define["import.meta.env.PUBLIC_FA_PROMPT_ADMIN_ROLE"]).toBe(JSON.stringify("admin"));
  });

  it("injects starter routes and respects integration order", () => {
    const { injectRoute, logger } = runSetup(
      { mode: "starter" },
      {
        config: {
          integrations: [
            { name: "@mano8/astro-auth-m8" },
            { name: "@mano8/astro-prompt-m8" }
          ]
        }
      }
    );
    expect(injectRoute).toHaveBeenCalledTimes(4);
    const patterns = injectRoute.mock.calls.map(([arg]) => (arg as { pattern: string }).pattern);
    expect(patterns).toContain("/prompt/blocks");
    expect(patterns).toContain("/admin/prompts");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("injects package starter route entrypoints for Starlight pages", () => {
    const { injectRoute } = runSetup({ mode: "starter", auth: { provider: "none" } });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/prompt/blocks",
      entrypoint: "@mano8/astro-prompt-m8/routes/blocks.astro"
    });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/prompt/templates",
      entrypoint: "@mano8/astro-prompt-m8/routes/templates.astro"
    });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/prompt/composer",
      entrypoint: "@mano8/astro-prompt-m8/routes/composer.astro"
    });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/admin/prompts",
      entrypoint: "@mano8/astro-prompt-m8/routes/admin/prompts.astro"
    });
  });

  it("warns when the auth plugin is registered after prompt", () => {
    const { logger } = runSetup(
      { mode: "starter" },
      {
        config: {
          integrations: [
            { name: "@mano8/astro-prompt-m8" },
            {},
            { name: "@mano8/astro-auth-m8" }
          ]
        }
      }
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("should be listed before"));
  });

  it("warns when starter routes use the official auth provider without the auth plugin", () => {
    const { logger } = runSetup({ mode: "starter" }, { config: {} });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("@mano8/astro-auth-m8"));
  });

  it("does not warn about order when prompt is absent from the list", () => {
    const { logger } = runSetup(
      { mode: "headless" },
      { config: { integrations: [{ name: "@mano8/astro-auth-m8" }] } }
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns for a custom provider without an adapter import, but not with one", () => {
    const without = runSetup({ auth: { provider: "custom" } });
    expect(without.logger.warn).toHaveBeenCalledWith(expect.stringContaining("custom"));
    const withImport = runSetup({ auth: { provider: "custom", adapterImport: "./my-adapter.js" } });
    expect(withImport.logger.warn).not.toHaveBeenCalled();
  });

  it("warns when starter routes are enabled with provider none", () => {
    const { injectRoute, logger } = runSetup({ mode: "starter", auth: { provider: "none" } });
    expect(injectRoute).toHaveBeenCalledTimes(4);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("requires fa-auth-m8"));
  });

  it("skips route injection when views.strategy is none", () => {
    const { injectRoute } = runSetup({
      mode: "starter",
      auth: { provider: "none" },
      views: { strategy: "none" }
    });
    expect(injectRoute).not.toHaveBeenCalled();
  });

  it("skips the admin route when admin is disabled and skips disabled fragments", () => {
    const { injectRoute } = runSetup({
      mode: "starter",
      auth: { provider: "none" },
      admin: { enabled: false },
      routes: { blocks: false }
    });
    const patterns = injectRoute.mock.calls.map(([arg]) => (arg as { pattern: string }).pattern);
    expect(patterns).not.toContain("/admin/prompts");
    expect(patterns).not.toContain("/prompt/blocks");
    expect(patterns).toContain("/prompt/templates");
  });

  it("registers middleware when guards are enabled", () => {
    const { addMiddleware } = runSetup({ guards: { middleware: true } });
    expect(addMiddleware).toHaveBeenCalledWith({
      order: "pre",
      entrypoint: "@mano8/astro-prompt-m8/middleware"
    });
  });

  it("injects an empty CSP policy when middleware is not active (headless default)", () => {
    const { updateConfig } = runSetup({ apiBase: "/prompt" });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    expect(define["import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY"]).toBe(JSON.stringify(""));
  });

  it("injects a non-empty CSP policy when middleware is active", () => {
    const { updateConfig } = runSetup({ guards: { middleware: true } });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(
      define["import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY"] as string
    ) as string;
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("connect-src 'self'");
  });

  it("includes prompt origin in CSP connect-src when apiBase is an external URL", () => {
    const { updateConfig } = runSetup({
      apiBase: "https://prompt.example.com/prompt",
      guards: { middleware: true }
    });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(
      define["import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY"] as string
    ) as string;
    expect(policy).toContain("https://prompt.example.com");
  });

  it("injects an empty CSP policy when csp.enabled is false even if middleware is active", () => {
    const { updateConfig } = runSetup({ guards: { middleware: true }, csp: { enabled: false } });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    expect(define["import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY"]).toBe(JSON.stringify(""));
  });

  it("forwards csp.serviceOrigin and connectExtraOrigins into connect-src", () => {
    const { updateConfig } = runSetup({
      guards: { middleware: true },
      csp: {
        serviceOrigin: "https://prompt.example.com",
        connectExtraOrigins: ["https://auth.example.com"]
      }
    });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(
      define["import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY"] as string
    ) as string;
    expect(policy).toContain("https://prompt.example.com");
    expect(policy).toContain("https://auth.example.com");
  });
});

describe("middleware", () => {
  it("passes through to next when no CSP policy is set", () => {
    const next = vi.fn().mockReturnValue(new Response("ok"));
    // @ts-expect-error import.meta.env is not typed in tests
    import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY = "";
    const result = onRequest({}, next);
    expect(next).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
  });

  it("injects the CSP header on a synchronous response", () => {
    // @ts-expect-error import.meta.env is not typed in tests
    import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY = "default-src 'self'";
    const next = vi.fn().mockReturnValue(new Response("body", { status: 200 }));
    const result = onRequest({}, next) as Response;
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'self'");
  });

  it("injects the CSP header on an async response", async () => {
    // @ts-expect-error import.meta.env is not typed in tests
    import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY = "default-src 'self'";
    const next = vi.fn().mockResolvedValue(new Response("body", { status: 200 }));
    const result = await (onRequest({}, next) as Promise<Response>);
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'self'");
  });

  it("does not overwrite an existing CSP header", () => {
    // @ts-expect-error import.meta.env is not typed in tests
    import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY = "default-src 'self'";
    const existing = new Response("body", {
      headers: { "Content-Security-Policy": "default-src 'none'" }
    });
    const next = vi.fn().mockReturnValue(existing);
    const result = onRequest({}, next) as Response;
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'none'");
  });
});
