import type { PromptBlockListParams, PromptTemplateListParams, CategoryListParams } from "./schemas.js";

type QueryKeyParamValue = boolean | number | string | null | undefined;
type QueryKeyParams = Record<string, QueryKeyParamValue>;
const EMPTY_PARAMS = Object.freeze({}) as Readonly<Record<string, never>>;

function normalizeParams<TParams extends QueryKeyParams>(
  params: TParams = {} as TParams
): Readonly<Partial<TParams>> {
  const entries = Object.entries(params)
    .filter(
      (entry): entry is [keyof TParams & string, Exclude<TParams[keyof TParams], undefined>] =>
        entry[1] !== undefined
    )
    .sort(([left], [right]) => left.localeCompare(right));

  return entries.length
    ? (Object.freeze(Object.fromEntries(entries)) as unknown as Readonly<Partial<TParams>>)
    : (EMPTY_PARAMS as Readonly<Partial<TParams>>);
}

type BlockListParams = PromptBlockListParams;
type TemplateListParams = PromptTemplateListParams;
type CategoryList = CategoryListParams;

export const promptKeys = {
  all: () => ["prompt"] as const,
  blockLists: () => ["prompt", "blocks"] as const,
  blocks: (params: BlockListParams = {}) => ["prompt", "blocks", normalizeParams(params)] as const,
  block: (blockId: number) => ["prompt", "block", blockId] as const,
  blockSlug: (slug: string) => ["prompt", "block-slug", slug] as const,
  templateLists: () => ["prompt", "templates"] as const,
  templates: (params: TemplateListParams = {}) =>
    ["prompt", "templates", normalizeParams(params)] as const,
  template: (templateId: number) => ["prompt", "template", templateId] as const,
  templateSlug: (slug: string) => ["prompt", "template-slug", slug] as const,
  templateBlocks: (templateId: number) => ["prompt", "template-blocks", templateId] as const,
  compose: (templateId: number) => ["prompt", "compose", templateId] as const,
  categoryLists: () => ["prompt", "categories"] as const,
  categories: (params: CategoryList = {}) =>
    ["prompt", "categories", normalizeParams(params)] as const,
  category: (categoryId: number) => ["prompt", "category", categoryId] as const,
  adminOverview: () => ["prompt", "admin", "overview"] as const,
  dashboardActivity: () => ["prompt", "dashboard", "activity"] as const,
  dashboardActivityCurrent: () => ["prompt", "dashboard", "activity-current"] as const
};