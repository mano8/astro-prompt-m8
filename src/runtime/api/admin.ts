import { request } from "../client.js";
import {
  CategoriesPublicSchema,
  PromptBlocksPublicSchema,
  PromptTemplatesPublicSchema,
  UsersActivitySchema,
  type CategoriesPublic,
  type PromptBlocksPublic,
  type PromptTemplatesPublic,
  type UsersActivity
} from "../schemas.js";

/**
 * Aggregate admin overview: block/template/category counters + activity. The
 * prompt-engine-m8 service has no purge/repair surface (unlike media-service-m8),
 * so the admin side is read-only here; destructive creates/edits stay on the
 * per-resource views behind confirmation panels.
 */
export type PromptAdminOverview = {
  blocks: PromptBlocksPublic;
  templates: PromptTemplatesPublic;
  categories: CategoriesPublic | null;
  activity: UsersActivity;
};

export async function getAdminOverview(): Promise<PromptAdminOverview> {
  const [blocks, templates, categories, activity] = await Promise.all([
    request({
      method: "GET",
      path: "/prompt-block/",
      query: { skip: 0, limit: 100 },
      schema: PromptBlocksPublicSchema,
      auth: true,
      admin: true
    }),
    request({
      method: "GET",
      path: "/prompt-template/",
      query: { skip: 0, limit: 100 },
      schema: PromptTemplatesPublicSchema,
      auth: true,
      admin: true
    }),
    request({
      method: "GET",
      path: "/category/",
      query: { skip: 0, limit: 100 },
      schema: CategoriesPublicSchema.nullable(),
      auth: true,
      admin: true
    }),
    request({
      method: "GET",
      path: "/dashboard/users/activity/",
      schema: UsersActivitySchema,
      auth: true,
      admin: true
    })
  ]);
  return { blocks, templates, categories, activity };
}