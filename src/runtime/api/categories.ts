import { request } from "../client.js";
import { unwrap, unwrapOrNull } from "./blocks.js";
import {
  CategoriesPublicSchema,
  CategoryCreateSchema,
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

export async function listCategories(
  params: CategoryListParams = {}
): Promise<CategoriesPublic | null> {
  return request({
    method: "GET",
    path: "/category/",
    query: { skip: params.skip ?? 0, limit: params.limit ?? 100 },
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