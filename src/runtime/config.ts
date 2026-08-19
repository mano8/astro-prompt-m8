export type PromptRuntimeConfig = {
  /** Browser-facing base used by all requests. Mirror of `PUBLIC_PROMPT_API_BASE`. */
  apiBase: string;
  /** API prefix from the prompt-engine-m8 service contract. Default `/fastapi`. */
  apiPrefix: string;
  /** Header sent on every request so a same-origin stack can pin CSRF. */
  csrfHeader: string;
  /**
   * Minimum role that grants admin access through the auth adapter.
   *
   * Defaults to `admin`, matching the floor prompt-engine-m8 enforces on
   * `/dashboard/*` (`require_admin`). Any of the ordered M8 roles is read as a
   * floor — `superadmin` also passes an `admin` gate — while any other string
   * keeps the older exact-match behaviour, so a host on a custom role vocabulary
   * (including the previous `is_superuser` default) is unaffected.
   */
  adminRole: string;
  /** Compose / list hard timeout for client-side fetches, in milliseconds. */
  requestTimeoutMs: number;
};

const DEFAULT_CONFIG: PromptRuntimeConfig = {
  apiBase: "/prompt",
  apiPrefix: "/fastapi",
  csrfHeader: "X-Requested-With",
  adminRole: "admin",
  requestTimeoutMs: 30_000
};

let runtimeConfig: PromptRuntimeConfig = cloneConfig(DEFAULT_CONFIG);

function cloneConfig(config: PromptRuntimeConfig): PromptRuntimeConfig {
  return { ...config };
}

export function configurePrompt(
  config: Partial<PromptRuntimeConfig> = {}
): PromptRuntimeConfig {
  runtimeConfig = { ...runtimeConfig, ...config };
  return runtimeConfig;
}

export function getPromptConfig(): PromptRuntimeConfig {
  return runtimeConfig;
}

export function resetPromptConfig(): void {
  runtimeConfig = cloneConfig(DEFAULT_CONFIG);
}