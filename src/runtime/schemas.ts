import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums — mirror promt_engine_service/schemas/base.py & db_models/prompts.py
// ---------------------------------------------------------------------------

export const PromptBlockTypeSchema = z.enum([
  "role",
  "task",
  "context",
  "instruction",
  "example",
  "format"
]);
export type PromptBlockType = z.infer<typeof PromptBlockTypeSchema>;

export const CategoryTypeSchema = z.enum(["prompt_block", "prompt_template"]);
export type CategoryType = z.infer<typeof CategoryTypeSchema>;

// ---------------------------------------------------------------------------
// Response envelopes — mirror auth_sdk_m8.schemas.base
// ---------------------------------------------------------------------------

export const ResponseMessageSchema = z
  .object({
    success: z.boolean(),
    msg: z.string()
  })
  .strict();
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;

export const ResponseModelBaseSchema = z
  .object({
    success: z.boolean(),
    data: z.unknown()
  })
  .strict();
export type ResponseModelBase = z.infer<typeof ResponseModelBaseSchema>;

export const ResponseModelOrMessageSchema = z.union([
  ResponseModelBaseSchema,
  ResponseMessageSchema
]);
export type ResponseModelOrMessage = z.infer<typeof ResponseModelOrMessageSchema>;

// ---------------------------------------------------------------------------
// Service metadata — mirrors auth_sdk_m8.schemas.meta.ServiceMeta, which every
// M8 service serves unauthenticated at `{API_PREFIX}/meta`.
//
// Deliberately loose rather than `.strict()`: `/meta` is read before anything
// else on the session, so a field added to the shared schema must not turn the
// compatibility preflight into the outage it exists to prevent. The fields the
// preflight actually reads are pinned; the rest is passed through untouched.
// ---------------------------------------------------------------------------

export const ServiceContractSchema = z.looseObject({
  name: z.string().min(1),
  version: z.string().min(1),
  range: z.string().min(1)
});
export type ServiceContract = z.infer<typeof ServiceContractSchema>;

export const ServiceMetaSchema = z.looseObject({
  service: z.string().min(1),
  version: z.string().min(1),
  api_version: z.string().min(1),
  contract: ServiceContractSchema
});
export type ServiceMeta = z.infer<typeof ServiceMetaSchema>;

// ---------------------------------------------------------------------------
// Prompt blocks
// ---------------------------------------------------------------------------

const ownerIdSchema = z.string();

export const PromptBlockPublicSchema = z
  .object({
    id: z.number().int(),
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100),
    description: z.string().nullable(),
    content: z.string().min(1).max(5000),
    type: PromptBlockTypeSchema,
    is_dynamic: z.boolean(),
    is_public: z.boolean(),
    owner_id: ownerIdSchema
  })
  .strict();
export type PromptBlockPublic = z.infer<typeof PromptBlockPublicSchema>;

export const PromptBlockCreateSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).nullable().optional(),
    content: z.string().min(1).max(5000),
    type: PromptBlockTypeSchema,
    is_dynamic: z.boolean().optional(),
    is_public: z.boolean().optional(),
    slug: z.string().nullable().optional()
  })
  .strict();
export type PromptBlockCreate = z.infer<typeof PromptBlockCreateSchema>;

export const PromptBlockUpdateSchema = PromptBlockCreateSchema;
export type PromptBlockUpdate = z.infer<typeof PromptBlockUpdateSchema>;

export const PromptBlocksPublicSchema = z
  .object({
    data: z.array(PromptBlockPublicSchema),
    count: z.number().int().nonnegative()
  })
  .strict();
export type PromptBlocksPublic = z.infer<typeof PromptBlocksPublicSchema>;

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

export const TemplateBlockPublicSchema = z
  .object({
    id: z.number().int(),
    block_id: z.number().int(),
    template_id: z.number().int(),
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100),
    description: z.string().nullable(),
    content: z.string().min(1).max(5000),
    type: PromptBlockTypeSchema,
    is_dynamic: z.boolean(),
    is_public: z.boolean(),
    position: z.number().int().nonnegative()
  })
  .strict();
export type TemplateBlockPublic = z.infer<typeof TemplateBlockPublicSchema>;

export const PromptTemplatePublicSchema = z
  .object({
    id: z.number().int(),
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100),
    description: z.string().nullable(),
    is_public: z.boolean(),
    blocks: z.array(TemplateBlockPublicSchema)
  })
  .strict();
export type PromptTemplatePublic = z.infer<typeof PromptTemplatePublicSchema>;

export const PromptTemplateCreateSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(1000).nullable().optional(),
    is_public: z.boolean().optional(),
    slug: z.string().nullable().optional()
  })
  .strict();
export type PromptTemplateCreate = z.infer<typeof PromptTemplateCreateSchema>;

export const PromptTemplateUpdateSchema = PromptTemplateCreateSchema;
export type PromptTemplateUpdate = z.infer<typeof PromptTemplateUpdateSchema>;

export const PromptTemplatesPublicSchema = z
  .object({
    data: z.array(PromptTemplatePublicSchema),
    count: z.number().int().nonnegative()
  })
  .strict();
export type PromptTemplatesPublic = z.infer<typeof PromptTemplatesPublicSchema>;

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

export const DYNAMIC_CONTENT_PLACEHOLDER = "{{dynamic_content}}";

export function hasDynamicContentPlaceholder(content: string): boolean {
  return content.includes(DYNAMIC_CONTENT_PLACEHOLDER);
}

export function insertDynamicContentPlaceholder(
  content: string,
  selectionStart: number = content.length,
  selectionEnd: number = selectionStart
): string {
  const start = Math.max(0, Math.min(selectionStart, content.length));
  const end = Math.max(start, Math.min(selectionEnd, content.length));
  return `${content.slice(0, start)}${DYNAMIC_CONTENT_PLACEHOLDER}${content.slice(end)}`;
}

export const DynamicBlockSchema = z
  .object({
    id: z.number().int().positive(),
    content: z.string().min(1).max(5000)
  })
  .strict();
export type DynamicBlock = z.infer<typeof DynamicBlockSchema>;

export const ComposedPromptSchema = z
  .object({
    content: z.string()
  })
  .strict();
export type ComposedPrompt = z.infer<typeof ComposedPromptSchema>;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const CategoryPublicSchema = z
  .object({
    id: z.number().int(),
    name: z.string().min(1).max(50),
    slug: z.string().min(1).max(50),
    type: CategoryTypeSchema,
    owner_id: ownerIdSchema
  })
  .strict();
export type CategoryPublic = z.infer<typeof CategoryPublicSchema>;

export const CategoriesPublicSchema = z
  .object({
    data: z.array(CategoryPublicSchema),
    count: z.number().int().nonnegative()
  })
  .strict();
export type CategoriesPublic = z.infer<typeof CategoriesPublicSchema>;

/**
 * Create payload for `POST /category/add/`.
 *
 * `type` is **required**, mirroring the service's `CategoryCreate`. It was
 * absent here while the service demanded it (`H2`), so every create this schema
 * produced was a 422 the client could not see: the payload parsed locally and
 * failed on the wire. `D-C1` put the fix on this side deliberately — the caller
 * knows whether it is filing a block or a template category, and a server-chosen
 * default would be a guess wearing a contract's clothes.
 *
 * `slug` is *not* accepted. The service derives it from `name` in a `before`
 * validator and overwrites whatever a caller sends, so offering the field here
 * would publish a knob that does nothing.
 */
export const CategoryCreateSchema = z
  .object({
    name: z.string().min(1).max(50),
    type: CategoryTypeSchema
  })
  .strict();
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;

/** `PUT /category/edit/{id}/` takes the same shape — the service reuses it. */
export const CategoryUpdateSchema = CategoryCreateSchema;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;

// ---------------------------------------------------------------------------
// Portable import/export (user-agnostic block/template transfer)
//
// A portable payload strips server-owned identity (`id`, `owner_id`,
// template-link ids) so an export produced by one user can be imported by any
// other. Dedup on import is keyed on `slug`. See `runtime/api/transfer.ts`.
// ---------------------------------------------------------------------------

export const PROMPT_EXPORT_FORMAT = "astro-prompt-m8/export" as const;
export const PROMPT_EXPORT_VERSION = 1 as const;

/** A block without server identity — safe to hand to another user's account. */
export const PortableBlockSchema = z
  .object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).nullable().optional(),
    description: z.string().max(1000).nullable().optional(),
    content: z.string().min(1).max(5000),
    type: PromptBlockTypeSchema,
    is_dynamic: z.boolean().default(false),
    is_public: z.boolean().default(false)
  })
  .strict();
export type PortableBlock = z.infer<typeof PortableBlockSchema>;

/** A template's block reference: its ordering plus the self-contained block. */
export const PortableTemplateBlockSchema = z
  .object({
    position: z.number().int().nonnegative(),
    block: PortableBlockSchema
  })
  .strict();
export type PortableTemplateBlock = z.infer<typeof PortableTemplateBlockSchema>;

/** A template without server identity, carrying its full block definitions. */
export const PortableTemplateSchema = z
  .object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).nullable().optional(),
    description: z.string().max(1000).nullable().optional(),
    is_public: z.boolean().default(false),
    blocks: z.array(PortableTemplateBlockSchema).default([])
  })
  .strict();
export type PortableTemplate = z.infer<typeof PortableTemplateSchema>;

/** The top-level JSON envelope written by export / read by import. */
export const PromptExportSchema = z
  .object({
    format: z.literal(PROMPT_EXPORT_FORMAT),
    version: z.literal(PROMPT_EXPORT_VERSION),
    exportedAt: z.string(),
    blocks: z.array(PortableBlockSchema).default([]),
    templates: z.array(PortableTemplateSchema).default([])
  })
  .strict();
export type PromptExport = z.infer<typeof PromptExportSchema>;

type BlockLike = {
  name: string;
  slug?: string | null;
  description: string | null;
  content: string;
  type: PromptBlockType;
  is_dynamic: boolean;
  is_public: boolean;
};

/** Strip server identity (`id`, `owner_id`, link ids) from a block. */
export function toPortableBlock(block: BlockLike): PortableBlock {
  return {
    name: block.name,
    slug: block.slug ?? null,
    description: block.description,
    content: block.content,
    type: block.type,
    is_dynamic: block.is_dynamic,
    is_public: block.is_public
  };
}

/** Strip server identity from a template, ordering its blocks by position. */
export function toPortableTemplate(template: PromptTemplatePublic): PortableTemplate {
  return {
    name: template.name,
    slug: template.slug,
    description: template.description,
    is_public: template.is_public,
    blocks: [...template.blocks]
      .sort((left, right) => left.position - right.position)
      .map((block) => ({ position: block.position, block: toPortableBlock(block) }))
  };
}

/** Wrap portable blocks/templates in a versioned export envelope. */
export function buildPromptExport(
  parts: { blocks?: PortableBlock[]; templates?: PortableTemplate[] },
  exportedAt: string = new Date().toISOString()
): PromptExport {
  return {
    format: PROMPT_EXPORT_FORMAT,
    version: PROMPT_EXPORT_VERSION,
    exportedAt,
    blocks: parts.blocks ?? [],
    templates: parts.templates ?? []
  };
}

/** Validate untrusted JSON as a PromptExport (throws on malformed input). */
export function parsePromptExport(input: unknown): PromptExport {
  return PromptExportSchema.parse(input);
}

/** Pretty-print an export for download. */
export function serializePromptExport(data: PromptExport): string {
  return JSON.stringify(data, null, 2);
}

/** Slug-based, collision-safe filename for a downloaded export. */
export function promptExportFilename(kind: "block" | "template" | "bundle", slug?: string | null): string {
  const safe = (slug ?? "").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `prompt-${kind}${safe ? `-${safe}` : ""}.json`;
}

// ---------------------------------------------------------------------------
// Dashboard (mirror schemas/dashboard.py UsersActivity)
// ---------------------------------------------------------------------------

export const ActivityCounterSchema = z
  .object({
    model: z.string(),
    updated: z.number().int(),
    added: z.number().int()
  })
  .strict();
export type ActivityCounter = z.infer<typeof ActivityCounterSchema>;

export const ActivityStatsSchema = z
  .object({
    min: z.number().int(),
    max: z.number().int(),
    activity: z.array(ActivityCounterSchema)
  })
  .strict();
export type ActivityStats = z.infer<typeof ActivityStatsSchema>;

export const UsersActivitySchema = z
  .object({
    nb_users: z.number().int().nonnegative(),
    activity: ActivityStatsSchema
  })
  .strict();
export type UsersActivity = z.infer<typeof UsersActivitySchema>;

// ---------------------------------------------------------------------------
// Declared list vocabulary — mirrors promt_engine_service/schemas/list_params.py
//
// The service publishes the values `q`/`csrc`/`sort`/`order`/`f` may carry, as
// enums that reach its OpenAPI document verbatim, and answers an undeclared one
// with a 422 rather than ignoring it. These constants are that vocabulary
// mirrored — not guessed — so a table control the UI renders is one the service
// answers. A value listed here and nowhere in the service is a contract break,
// not a local preference; the contract-fidelity tests are where the two halves
// are compared.
//
// Nothing here carries `vsrc`: the client's URL-state helper has such a field
// (see `listParams.ts`), the service declares no such parameter, and forwarding
// it would be a promise no handler keeps.
// ---------------------------------------------------------------------------

/** Upper bound the service puts on `q` and on the joined `f` value. */
export const MAX_LIST_SEARCH_LENGTH = 200;

/** `f` carries several facet values in one parameter, joined by this. */
export const LIST_FACET_SEPARATOR = ",";

export const listSortOrders = ["asc", "desc"] as const;
export type ListSortOrder = (typeof listSortOrders)[number];

/** Columns `q` may scan, and `csrc` may name, on `GET /prompt-block/`. */
export const promptBlockSearchFields = ["name", "slug", "description", "content"] as const;
export type PromptBlockSearchField = (typeof promptBlockSearchFields)[number];

/** Columns `sort` may order by on `GET /prompt-block/`. */
export const promptBlockSortFields = [
  "id",
  "name",
  "slug",
  "type",
  "is_dynamic",
  "is_public",
  "created_at",
  "updated_at"
] as const;
export type PromptBlockSortField = (typeof promptBlockSortFields)[number];

/** Values `f` may carry on `GET /prompt-block/`; selected facets combine with OR. */
export const promptBlockFacets = [
  "role",
  "task",
  "context",
  "instruction",
  "example",
  "format",
  "dynamic",
  "static",
  "public",
  "private"
] as const;
export type PromptBlockFacet = (typeof promptBlockFacets)[number];

/** Columns `q` may scan, and `csrc` may name, on `GET /prompt-template/`. */
export const promptTemplateSearchFields = ["name", "slug", "description"] as const;
export type PromptTemplateSearchField = (typeof promptTemplateSearchFields)[number];

/**
 * Columns `sort` may order by on `GET /prompt-template/`. `block_count` is not
 * a column — the service answers it with a correlated subquery — but the
 * template table offers that header, so the vocabulary declares it.
 */
export const promptTemplateSortFields = [
  "id",
  "name",
  "slug",
  "is_public",
  "block_count",
  "created_at",
  "updated_at"
] as const;
export type PromptTemplateSortField = (typeof promptTemplateSortFields)[number];

/** Values `f` may carry on `GET /prompt-template/`. */
export const promptTemplateFacets = ["public", "private"] as const;
export type PromptTemplateFacet = (typeof promptTemplateFacets)[number];

/**
 * Columns `q` scans on `GET /category/`. Declared for symmetry: the endpoint
 * offers no `csrc`, so a caller cannot narrow the scan to one of them.
 */
export const categorySearchFields = ["name", "slug"] as const;
export type CategorySearchField = (typeof categorySearchFields)[number];

/** Columns `sort` may order by on `GET /category/`. */
export const categorySortFields = [
  "id",
  "name",
  "slug",
  "type",
  "created_at",
  "updated_at"
] as const;
export type CategorySortField = (typeof categorySortFields)[number];

// ---------------------------------------------------------------------------
// List-params request schemas
//
// Each schema is `.strict()`, so a parameter the endpoint does not declare is a
// local parse error rather than a query string the service silently drops:
// `/category/` publishes no `csrc` and no `f`, and that emptiness is part of the
// contract. An empty string is accepted wherever an enum is, because an unset
// table control sends `sort=`/`f=` rather than omitting them — the service reads
// blank as absent (`blank_to_none`) and so does the wire helper.
// ---------------------------------------------------------------------------

/** Accepts a declared value or the blank string an unset control produces. */
function enumOrBlank<TValue extends string>(values: readonly [TValue, ...TValue[]]) {
  return z.enum(values).or(z.literal(""));
}

/**
 * A comma-joined facet list, every part of which must be declared. The joined
 * value is bounded like the service bounds it.
 */
function facetList<TValue extends string>(values: readonly TValue[]) {
  return z
    .string()
    .max(MAX_LIST_SEARCH_LENGTH)
    .refine(
      (value) =>
        value === "" ||
        value
          .split(LIST_FACET_SEPARATOR)
          .every((part) => (values as readonly string[]).includes(part)),
      { message: "Undeclared facet value" }
    );
}

const offsetParams = {
  skip: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional()
};

const searchParam = z.string().max(MAX_LIST_SEARCH_LENGTH).optional();
const orderParam = enumOrBlank(listSortOrders).optional();

export const PromptBlockListParamsSchema = z
  .object({
    ...offsetParams,
    q: searchParam,
    csrc: enumOrBlank(promptBlockSearchFields).optional(),
    sort: enumOrBlank(promptBlockSortFields).optional(),
    order: orderParam,
    f: facetList(promptBlockFacets).optional()
  })
  .strict();
export type PromptBlockListParams = z.infer<typeof PromptBlockListParamsSchema>;

export const PromptTemplateListParamsSchema = z
  .object({
    ...offsetParams,
    q: searchParam,
    csrc: enumOrBlank(promptTemplateSearchFields).optional(),
    sort: enumOrBlank(promptTemplateSortFields).optional(),
    order: orderParam,
    f: facetList(promptTemplateFacets).optional()
  })
  .strict();
export type PromptTemplateListParams = z.infer<typeof PromptTemplateListParamsSchema>;

export const CategoryListParamsSchema = z
  .object({
    ...offsetParams,
    q: searchParam,
    sort: enumOrBlank(categorySortFields).optional(),
    order: orderParam
  })
  .strict();
export type CategoryListParams = z.infer<typeof CategoryListParamsSchema>;
