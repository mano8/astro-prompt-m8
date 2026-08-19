import { getPromptConfig } from "./config.js";

/**
 * Narrow runtime contract the prompt plugin consumes for authentication.
 *
 * The prompt plugin never owns token storage or refresh logic; it delegates to
 * whatever the host stack provides. `@mano8/astro-auth-m8` is the official
 * provider, but any object that satisfies this shape works.
 */
export type PromptAuthAdapter = {
  getAccessToken(): string | null | Promise<string | null>;
  refresh?(): Promise<string | null>;
  getUser?(): unknown | Promise<unknown>;
  requireUser?(): Promise<unknown>;
  isSuperuser?(user?: unknown): boolean;
  hasRole?(role: string, user?: unknown): boolean;
  onUnauthenticated?(reason: unknown): void;
};

export type InMemoryAuthAdapter = PromptAuthAdapter & {
  /** Set or clear the in-memory access token (never persisted). */
  setAccessToken(token: string | null): void;
};

/**
 * The M8 role vocabulary, highest privilege first — a mirror of
 * `auth_sdk_m8.schemas.base.RoleType.get_ordered_roles()`, by value rather than
 * by import, since the prompt plugin never depends on a service package.
 */
export const PROMPT_ROLE_ORDER = [
  "superadmin",
  "admin",
  "writer",
  "reader",
  "user"
] as const;
export type PromptRole = (typeof PROMPT_ROLE_ORDER)[number];

function isPromptRole(value: string): value is PromptRole {
  return (PROMPT_ROLE_ORDER as readonly string[]).includes(value);
}

/** True when `role` sits at or above `floor` in the ordered vocabulary. */
export function hasMinimumPromptRole(role: string, floor: string): boolean {
  if (!isPromptRole(role) || !isPromptRole(floor)) return false;
  return PROMPT_ROLE_ORDER.indexOf(role) <= PROMPT_ROLE_ORDER.indexOf(floor);
}

/**
 * Best-effort admin detection that does not depend on a specific user shape:
 * honours an explicit `is_superuser` flag, a `role` at or above the configured
 * floor, or a `roles` array carrying one.
 *
 * `D-C2` set that floor to `admin`, matching the `require_admin` the service now
 * enforces on `/dashboard/*`. Before this, the client admitted superusers only —
 * fail-closed, so never a hole, but it locked an ADMIN-tier user out of a
 * dashboard the service would have served them.
 *
 * A `adminRole` outside the ordered vocabulary is compared by equality exactly
 * as before, so a host on its own role strings keeps the behaviour it had.
 */
export function defaultIsSuperuser(
  user: unknown,
  adminRole = getPromptConfig().adminRole
): boolean {
  if (!user || typeof user !== "object") return false;
  const record = user as Record<string, unknown>;
  if (record.is_superuser === true) return true;

  const matches = (value: string) =>
    isPromptRole(adminRole) ? hasMinimumPromptRole(value, adminRole) : value === adminRole;

  if (adminRole !== "is_superuser" && typeof record.role === "string" && matches(record.role)) {
    return true;
  }
  return (
    Array.isArray(record.roles) &&
    record.roles.some((value) => typeof value === "string" && matches(value))
  );
}

/** A self-contained adapter that holds the token in memory only. */
export function createInMemoryAuthAdapter(initialToken: string | null = null): InMemoryAuthAdapter {
  let token = initialToken;
  return {
    getAccessToken: () => token,
    setAccessToken: (next) => {
      token = next;
    },
    isSuperuser: (user) => defaultIsSuperuser(user)
  };
}

export type FaAuthBindings = {
  getToken: () => string | null;
  refreshToken?: () => Promise<{ access_token?: string } | string | null | undefined>;
  getUser?: () => unknown | Promise<unknown>;
  isSuperuser?: (user?: unknown) => boolean;
  hasRole?: (role: string, user?: unknown) => boolean;
  onUnauthenticated?: (reason: unknown) => void;
};

/**
 * Build the official adapter from `@mano8/astro-auth-m8` bindings. The bindings
 * are injected by the consumer so the prompt plugin keeps the auth plugin as an
 * optional peer and never statically imports it.
 */
export function createFaAuthAdapter(bindings: FaAuthBindings): PromptAuthAdapter {
  return {
    getAccessToken: () => bindings.getToken(),
    refresh: async () => {
      if (!bindings.refreshToken) return null;
      const result = await bindings.refreshToken();
      if (!result) return null;
      return typeof result === "string" ? result : result.access_token ?? null;
    },
    getUser: bindings.getUser,
    isSuperuser: (user) =>
      bindings.isSuperuser ? bindings.isSuperuser(user) : defaultIsSuperuser(user),
    hasRole: bindings.hasRole,
    onUnauthenticated: bindings.onUnauthenticated
  };
}

let adapter: PromptAuthAdapter = createInMemoryAuthAdapter();

export function setPromptAuthAdapter(next: PromptAuthAdapter): PromptAuthAdapter {
  adapter = next;
  return adapter;
}

export function getPromptAuthAdapter(): PromptAuthAdapter {
  return adapter;
}

export function resetPromptAuthAdapter(): void {
  adapter = createInMemoryAuthAdapter();
}