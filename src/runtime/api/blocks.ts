import { request } from "../client.js";
import { toServiceExportQuery, toServiceListQuery } from "../listParams.js";
import {
  PromptBlockListParamsSchema,
  PromptBlocksExportSchema,
  PromptBlocksPublicSchema,
  ResponseMessageSchema,
  ResponseModelBaseSchema,
  type PromptBlockCreate,
  type PromptBlockListParams,
  type PromptBlockPublic,
  type PromptBlockUpdate,
  type PromptBlocksExport,
  type PromptBlocksPublic,
  type ResponseMessage,
  type ResponseModelBase
} from "../schemas.js";

/**
 * List prompt blocks. The whole declared vocabulary — `q`, `csrc`, `sort`,
 * `order`, `f` — reaches the wire beside the offset pair; the params are parsed
 * first, so an undeclared value fails here rather than as a service 422.
 * `count` in the response is the count of the filtered set.
 */
export async function listBlocks(params: PromptBlockListParams = {}): Promise<PromptBlocksPublic> {
  return request({
    method: "GET",
    path: "/prompt-block/",
    query: toServiceListQuery(PromptBlockListParamsSchema.parse(params)),
    schema: PromptBlocksPublicSchema,
    auth: true
  });
}

/**
 * Export every prompt block in the filtered set (`A-C8`), not one fetched
 * page. Carries the same filter vocabulary as {@link listBlocks} minus
 * `skip`/`limit`/`page`/`pageSize` — the service route accepts none of those.
 */
export async function exportBlocks(
  params: Omit<PromptBlockListParams, "skip" | "limit" | "page" | "pageSize"> = {}
): Promise<PromptBlocksExport> {
  return request({
    method: "GET",
    path: "/prompt-block/export/",
    query: toServiceExportQuery(PromptBlockListParamsSchema.parse(params)),
    schema: PromptBlocksExportSchema,
    auth: true
  });
}

export async function getBlock(blockId: number): Promise<PromptBlockPublic> {
  return unwrap(
    await request<ResponseModelBase>({
      method: "GET",
      path: `/prompt-block/get/${blockId}/`,
      schema: ResponseModelBaseSchema,
      auth: true
    })
  );
}

export async function getBlockBySlug(slug: string): Promise<PromptBlockPublic | null> {
  return unwrapOrNull(
    await request<ResponseModelBase | ResponseMessage>({
      method: "GET",
      path: `/prompt-block/get_by_slug/${encodeURIComponent(slug)}/`,
      schema: ResponseModelBaseSchema.or(ResponseMessageSchema),
      auth: true
    })
  );
}

export async function createBlock(body: PromptBlockCreate): Promise<PromptBlockPublic> {
  return unwrap(
    await request<ResponseModelBase>({
      method: "POST",
      path: "/prompt-block/add/",
      body,
      schema: ResponseModelBaseSchema,
      auth: true
    })
  );
}

export async function updateBlock(
  blockId: number,
  body: PromptBlockUpdate
): Promise<PromptBlockPublic> {
  return unwrap(
    await request<ResponseModelBase>({
      method: "PUT",
      path: `/prompt-block/edit/${blockId}/`,
      body,
      schema: ResponseModelBaseSchema,
      auth: true
    })
  );
}

export async function deleteBlock(blockId: number): Promise<ResponseMessage> {
  return request({
    method: "DELETE",
    path: `/prompt-block/delete/${blockId}/`,
    schema: ResponseMessageSchema,
    auth: true
  });
}

/** Extract data from a ResponseModelBase, throwing a synthetic 500 error when missing. */
function unwrap<T>(value: ResponseModelBase): T {
  if (value.data === null || value.data === undefined) {
    throw new ResponseDataMissingError();
  }
  return value.data as T;
}

/** Same as `unwrap` but accepts a ResponseMessage as a "not found" signal, yielding null. */
function unwrapOrNull<T>(
  value: ResponseModelBase | ResponseMessage
): T | null {
  if ("data" in value && value.data !== null && value.data !== undefined) {
    return value.data as T;
  }
  return null;
}

const ResponseDataMissingError = class extends Error {
  constructor() {
    super("Response reported failure with no data");
  }
};

export { unwrap, unwrapOrNull, ResponseDataMissingError };
