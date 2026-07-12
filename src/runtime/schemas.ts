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

export const CategoryCreateSchema = z
  .object({
    name: z.string().min(1).max(50)
  })
  .strict();
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;

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
// Misc list-params shape used by hooks
// ---------------------------------------------------------------------------

export type PromptBlockListParams = {
  skip?: number;
  limit?: number;
  page?: number;
  pageSize?: number;
  q?: string;
  csrc?: string;
  vsrc?: string;
  f?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export type PromptTemplateListParams = {
  skip?: number;
  limit?: number;
  page?: number;
  pageSize?: number;
  q?: string;
  csrc?: string;
  vsrc?: string;
  f?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export type CategoryListParams = {
  skip?: number;
  limit?: number;
};
