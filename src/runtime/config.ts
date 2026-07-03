export type PromptRuntimeConfig = {
  /** Browser-facing base used by all requests. Mirror of `PUBLIC_PROMPT_API_BASE`. */
  apiBase: string;
  /** API prefix from the prompt-engine-m8 service contract. Default `/fastapi`. */
  apiPrefix: string;
  /** Header sent on every request so a same-origin stack can pin CSRF. */
  csrfHeader: string;
  /** Role string that grants admin access through the auth adapter. */
  adminRole: string;
  /** Compose / list hard timeout for client-side fetches, in milliseconds. */
  requestTimeoutMs: number;
};

const DEFAULT_CONFIG: PromptRuntimeConfig = {
  apiBase: "/prompt",
  apiPrefix: "/fastapi",
  csrfHeader: "X-Requested-With",
  adminRole: "is_superuser",
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