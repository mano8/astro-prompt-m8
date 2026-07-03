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
