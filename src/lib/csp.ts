export type PromptCspOptions = {
  /**
   * Public origin of the prompt-engine-m8 service when configured behind an
   * absolute URL (e.g. `"https://prompt.example.com"`).
   * Ignored when empty or not a valid absolute URL.
   */
  serviceOrigin?: string;
  connectExtraOrigins?: string[];
};

/** Extracts the origin (scheme + host + port) from an absolute URL; returns null for relative paths. */
export function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Builds the `connect-src` directive value for the prompt service and any extra origins.
 * Relative `apiBase` values (e.g. `/prompt`) add nothing beyond `'self'`.
 */
export function buildPromptConnectSrc(apiBase: string, extraOrigins: string[] = []): string {
  const origins = new Set(["'self'"]);
  const promptOrigin = originOf(apiBase);
  if (promptOrigin) origins.add(promptOrigin);
  for (const o of extraOrigins) {
    const origin = originOf(o);
    if (origin) origins.add(origin);
  }
  return [...origins].join(" ");
}

/**
 * Builds a Content-Security-Policy header value for prompt integration routes.
 *
 * Scripts are strict (`'self'` only, no `'unsafe-inline'`).
 * Styles allow `'unsafe-inline'` because React/Radix set inline styles that cannot be hashed.
 * The `connect-src` directive includes the prompt API origin when `apiBase` is an absolute URL.
 */
export function buildPromptCspPolicy(apiBase: string, options: PromptCspOptions = {}): string {
  const extraOrigins = [
    ...(options.serviceOrigin ? [options.serviceOrigin] : []),
    ...(options.connectExtraOrigins ?? [])
  ];
  const connectSrc = buildPromptConnectSrc(apiBase, extraOrigins);
  const directives: [string, string][] = [
    ["default-src", "'self'"],
    ["script-src", "'self'"],
    ["style-src", "'self' 'unsafe-inline'"],
    ["img-src", "'self' data: blob: https:"],
    ["font-src", "'self' data:"],
    ["connect-src", connectSrc],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"]
  ];
  return directives.map(([k, v]) => `${k} ${v}`).join("; ");
}