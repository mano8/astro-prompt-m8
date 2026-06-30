export type PromptRouteFragments = {
  base?: string;
  blocks?: string | false;
  templates?: string | false;
  composer?: string | false;
  admin?: string | false;
};

export type BuiltPromptRoutes = {
  blocks?: string;
  templates?: string;
  composer?: string;
  admin?: string;
};

const DEFAULT_FRAGMENTS: Required<Omit<PromptRouteFragments, "base">> & { base: string } = {
  base: "",
  blocks: "/prompt/blocks",
  templates: "/prompt/templates",
  composer: "/prompt/composer",
  admin: "/admin/prompts"
};

function joinRoute(base: string, fragment: string): string {
  const value = `/${[base, fragment].join("/")}`.replace(/\/+/g, "/");
  return value === "/" ? "/" : value.replace(/\/$/, "");
}

export function buildPromptRoutes(routes: PromptRouteFragments = {}): BuiltPromptRoutes {
  const merged = { ...DEFAULT_FRAGMENTS, ...routes };
  const base = merged.base ?? "";
  return {
    blocks: merged.blocks === false ? undefined : joinRoute(base, merged.blocks),
    templates: merged.templates === false ? undefined : joinRoute(base, merged.templates),
    composer: merged.composer === false ? undefined : joinRoute(base, merged.composer),
    admin: merged.admin === false ? undefined : joinRoute(base, merged.admin)
  };
}

export function routeForLocale(pattern: string, locale?: string): string {
  return locale
    ? pattern.replace("[locale]", locale)
    : pattern.replace("/:locale", "").replace("[locale]", "");
}

export function promptRedirect(
  routes: BuiltPromptRoutes,
  page: keyof BuiltPromptRoutes,
  locale?: string
): string {
  const route = routes[page];
  if (!route) return "/";
  return routeForLocale(route, locale);
}