import { request } from "../client.js";
import { toServiceListQuery } from "../listParams.js";
import { unwrap, unwrapOrNull } from "./blocks.js";
import {
  CategoriesPublicSchema,
  CategoryCreateSchema,
  CategoryListParamsSchema,
  CategoryUpdateSchema,
  ResponseMessageSchema,
  ResponseModelBaseSchema,
  type CategoriesPublic,
  type CategoryCreate,
  type CategoryListParams,
  type CategoryPublic,
  type CategoryUpdate,
  type ResponseMessage,
  type ResponseModelBase
} from "../schemas.js";

const ModelOrMessage = ResponseModelBaseSchema.or(ResponseMessageSchema);

/**
 * List categories. The endpoint publishes `q`/`sort`/`order` and deliberately
 * no `csrc` and no `f` — a category carries no public flag and no faceted axis
 * — so the params schema rejects those two rather than sending a parameter the
 * service would drop. `count` is the count of the filtered set.
 */
export async function listCategories(
  params: CategoryListParams = {}
): Promise<CategoriesPublic | null> {
  return request({
    method: "GET",
    path: "/category/",
    query: toServiceListQuery(CategoryListParamsSchema.parse(params)),
    // Service may return `null` when no categories exist (`Optional[CategoriesPublic]`).
    schema: CategoriesPublicSchema.nullable(),
    auth: true
  });
}

export async function getCategory(categoryId: number): Promise<CategoryPublic | null> {
  return unwrapOrNull(
    await request<ResponseModelBase | ResponseMessage>({
      method: "GET",
      path: `/category/get/${categoryId}/`,
      schema: ModelOrMessage,
      auth: true
    })
  );
}

export async function createCategory(body: CategoryCreate): Promise<CategoryPublic> {
  return unwrap(
    await request<ResponseModelBase>({
      method: "POST",
      path: "/category/add/",
      body: CategoryCreateSchema.parse(body),
      schema: ResponseModelBaseSchema,
      auth: true
    })
  );
}

export async function updateCategory(
  categoryId: number,
  body: CategoryUpdate
): Promise<CategoryPublic> {
  return unwrap(
    await request<ResponseModelBase>({
      method: "PUT",
      path: `/category/edit/${categoryId}/`,
      body: CategoryUpdateSchema.parse(body),
      schema: ResponseModelBaseSchema,
      auth: true
    })
  );
}

export async function deleteCategory(categoryId: number): Promise<ResponseMessage> {
  return request({
    method: "DELETE",
    path: `/category/delete/${categoryId}/`,
    schema: ResponseMessageSchema,
    auth: true
  });
}