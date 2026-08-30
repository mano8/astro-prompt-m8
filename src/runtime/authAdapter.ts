import { hasMinimumRole, ORDERED_ROLES } from "@mano8/astro-auth-m8/authorization";

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
 * The M8 role vocabulary, highest privilege first — the fleet's one list.
 *
 * This was a *copy* of `auth_sdk_m8.schemas.base.RoleType.get_ordered_roles()`
 * until 2026-08-29, written by value rather than by import because the fleet's
 * `no-cross-plugin-import` gate (`C12`, `scripts/verify-fleet-gates.mjs`)
 * refused the import. Decision 4 of the reparto remediation plan widened that
 * gate for exactly one specifier — `@mano8/astro-auth-m8/authorization`, the
 * pure, framework-neutral mirror of the SDK module — so the copy is gone and
 * `RBAC-06`, one role hierarchy across the fleet, is met by an import.
 *
 * The exemption is narrow on purpose: every other subpath of the auth peer is
 * still refused, and this package already requires `@mano8/astro-auth-m8` as a
 * peer dependency, so the import adds no install a consumer did not already
 * owe. What the plugin still refuses to import statically is the auth peer's
 * *runtime* — tokens, refresh, React — which is why {@link createFaAuthAdapter}
 * below takes injected bindings rather than importing them.
 *
 * Re-exported under the name this module already published, so the package
 * surface is unchanged and no caller moves.
 */
export const PROMPT_ROLE_ORDER = ORDERED_ROLES;
export type PromptRole = (typeof PROMPT_ROLE_ORDER)[number];

function isPromptRole(value: string): value is PromptRole {
  return (PROMPT_ROLE_ORDER as readonly string[]).includes(value);
}

/**
 * True when `role` sits at or above `floor` in the ordered vocabulary.
 *
 * The string-shaped seam over the peer's `hasMinimumRole`, which is typed to
 * the role union. Claims reaching this plugin come from a backend that may be
 * newer than the client and from host-configured `adminRole` strings, so both
 * arguments arrive as plain strings; an unrecognised one is not on the truth
 * table and answers `false` rather than being guessed at. The ordering itself
 * is the peer's, not a second implementation of it.
 */
export function hasMinimumPromptRole(role: string, floor: string): boolean {
  if (!isPromptRole(role) || !isPromptRole(floor)) return false;
  return hasMinimumRole(role, floor);
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
 * are injected by the consumer so the prompt plugin never statically imports the
 * auth peer's *runtime* — its token store, its refresh path or its React layer.
 * The one specifier it does import is `./authorization`, which holds no state
 * and reaches no browser global (see {@link PROMPT_ROLE_ORDER}).
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