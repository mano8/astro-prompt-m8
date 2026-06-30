import type { AstroIntegration } from "astro";
import { buildPromptRoutes, type PromptRouteFragments } from "./runtime/routes.js";
import { buildPromptCspPolicy, type PromptCspOptions } from "./lib/csp.js";

export type FaPromptAstroOptions = {
  /** Browser-facing base of the prompt-engine-m8 service. Defaults to `/prompt`. */
  apiBase?: string;
  /** FastAPI prefix on the service contract. Defaults to `/fastapi`. */
  apiPrefix?: string;
  mode?: "headless" | "starter";
  output?: "static" | "server" | "hybrid";
  locales?: string[];
  defaultLocale?: string;
  auth?: {
    provider?: "fa-auth-astro" | "custom" | "none";
    adapterImport?: string;
    requireAuth?: boolean;
    adminRole?: "superadmin" | "admin" | "is_superuser";
  };
  routes?: PromptRouteFragments;
  views?: {
    strategy?: "none" | "package" | "scaffolded";
    layout?: "plain" | "starlight" | "custom";
    customLayoutImport?: string;
    componentsImport?: string;
    i18nImport?: string;
  };
  admin?: {
    enabled?: boolean;
  };
  guards?: {
    middleware?: boolean;
  };
  /** CSP header support for server/hybrid output modes. Enabled by default when the middleware is active. */
  csp?: {
    /** Set to false to disable CSP header injection even when the middleware is active. Default: true. */
    enabled?: boolean;
  } & PromptCspOptions;
};

const ROUTE_ENTRYPOINTS = {
  blocks: "@mano8/astro-prompt-m8/routes/blocks.astro",
  templates: "@mano8/astro-prompt-m8/routes/templates.astro",
  composer: "@mano8/astro-prompt-m8/routes/composer.astro",
  admin: "@mano8/astro-prompt-m8/routes/admin/prompts.astro"
} as const;

const AUTH_INTEGRATION_NAME = "@mano8/astro-auth-m8";

/**
 * Warn when the official auth plugin is not registered before this one — order
 * matters because the prompt adapter resolves the auth runtime at module load.
 */
function checkAuthOrder(
  integrations: { name?: string }[] | undefined,
  logger?: { warn: (m: string) => void }
): void {
  const names = (integrations ?? []).map((entry) => entry?.name);
  const authIndex = names.indexOf(AUTH_INTEGRATION_NAME);
  const promptIndex = names.indexOf("@mano8/astro-prompt-m8");
  if (authIndex === -1) {
    logger?.warn(
      `auth.provider is "fa-auth-astro" but ${AUTH_INTEGRATION_NAME} is not in the integrations list`
    );
  } else if (promptIndex !== -1 && authIndex > promptIndex) {
    logger?.warn(`${AUTH_INTEGRATION_NAME} should be listed before @mano8/astro-prompt-m8`);
  }
}

export default function faPrompt(options: FaPromptAstroOptions = {}): AstroIntegration {
  const mode = options.mode ?? "headless";
  const provider = options.auth?.provider ?? "fa-auth-astro";
  const routes = buildPromptRoutes(options.routes);
  const apiBase = options.apiBase ?? "/prompt";
  const apiPrefix = options.apiPrefix ?? "/fastapi";

  const cspEnabled = options.csp?.enabled !== false;
  const middlewareActive = options.guards?.middleware === true;
  const cspPolicy =
    cspEnabled && middlewareActive
      ? buildPromptCspPolicy(apiBase, {
          serviceOrigin: options.csp?.serviceOrigin,
          connectExtraOrigins: options.csp?.connectExtraOrigins
        })
      : "";

  return {
    name: "@mano8/astro-prompt-m8",
    hooks: {
      "astro:config:setup": ({ injectRoute, addMiddleware, updateConfig, config, logger }) => {
        updateConfig({
          vite: {
            define: {
              "import.meta.env.PUBLIC_FA_PROMPT_API_BASE": JSON.stringify(apiBase),
              "import.meta.env.PUBLIC_FA_PROMPT_API_PREFIX": JSON.stringify(apiPrefix),
              "import.meta.env.PUBLIC_FA_PROMPT_ADMIN_ROLE": JSON.stringify(
                options.auth?.adminRole ?? "is_superuser"
              ),
              "import.meta.env.PUBLIC_FA_PROMPT_CSP_POLICY": JSON.stringify(cspPolicy)
            }
          }
        });

        // prompt-engine-m8 only accepts fa-auth-m8-issued tokens, so the auth
        // adapter must be backed by fa-auth-m8 (official astro-auth-m8 plugin,
        // or a custom adapter that obtains fa-auth-m8 tokens).
        if (provider === "fa-auth-astro") {
          checkAuthOrder(config?.integrations, logger);
        } else if (provider === "custom" && !options.auth?.adapterImport) {
          logger?.warn(
            "auth.provider is \"custom\" but no auth.adapterImport was given; configure a fa-auth-m8-compatible PromptAuthAdapter via setPromptAuthAdapter()"
          );
        }

        const starter = mode === "starter" && (options.views?.strategy ?? "package") !== "none";
        if (starter && provider === "none") {
          logger?.warn(
            "prompt starter routes are enabled but auth.provider is \"none\"; prompt-engine-m8 requires fa-auth-m8 authentication"
          );
        }

        if (starter) {
          for (const [name, pattern] of Object.entries(routes)) {
            if (!pattern) continue;
            if (name === "admin" && options.admin?.enabled === false) continue;
            injectRoute({
              pattern,
              entrypoint: ROUTE_ENTRYPOINTS[name as keyof typeof ROUTE_ENTRYPOINTS]
            });
          }
        }

        if (options.guards?.middleware) {
          addMiddleware({ order: "pre", entrypoint: "@mano8/astro-prompt-m8/middleware" });
        }
      }
    }
  };
}

export { buildPromptRoutes } from "./runtime/routes.js";
export type { PromptRouteFragments, BuiltPromptRoutes } from "./runtime/routes.js";