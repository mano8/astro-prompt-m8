import { request } from "../client.js";

const DEFAULT_TOKEN_ENV = "PROMPT_INTERNAL_SERVICE_TOKEN";

/**
 * Fail fast if this module is ever pulled into a browser bundle. The internal
 * surface is authenticated with a shared service token that must never leave
 * the server. prompt-engine-m8 has no internal endpoints today, but we expose
 * the same shape as media-m8 for symmetry and future use.
 */
function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "@mano8/astro-prompt-m8/internal-server must only be imported on the server"
    );
  }
}

function resolveServiceToken(envVar: string): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const token = env?.[envVar];
  if (!token) {
    throw new Error(`Missing service token: set ${envVar} in the server environment`);
  }
  return token;
}

export type InternalClientOptions = {
  /** Env var holding the shared service token. Default PROMPT_INTERNAL_SERVICE_TOKEN. */
  serviceTokenEnv?: string;
  /** Explicit token override (e.g. injected by a secret manager). */
  token?: string;
};

export type InternalPromptClient = {
  ping(): Promise<{ ok: true }>;
};

/**
 * Build a server-only client for service-to-service calls against
 * prompt-engine-m8. The shared service token is attached directly (never via
 * the user auth adapter) and refresh is disabled.
 */
export function createInternalPromptClient(
  options: InternalClientOptions = {}
): InternalPromptClient {
  assertServerOnly();
  const token = options.token ?? resolveServiceToken(options.serviceTokenEnv ?? DEFAULT_TOKEN_ENV);
  const headers = { Authorization: `Bearer ${token}` };

  return {
    async ping() {
      await request({
        method: "GET",
        path: "/",
        headers,
        skipRefresh: true
      });
      return { ok: true };
    }
  };
}