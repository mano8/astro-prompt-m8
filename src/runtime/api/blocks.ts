import { request } from "../client.js";
import { listParamsToOffset } from "../listParams.js";
import {
  PromptBlocksPublicSchema,
  ResponseMessageSchema,
  ResponseModelBaseSchema,
  type PromptBlockCreate,
  type PromptBlockListParams,
  type PromptBlockPublic,
  type PromptBlockUpdate,
  type PromptBlocksPublic,
  type ResponseMessage,
  type ResponseModelBase
} from "../schemas.js";

export async function listBlocks(params: PromptBlockListParams = {}): Promise<PromptBlocksPublic> {
  const offset =
    params.page !== undefined && params.pageSize !== undefined
      ? listParamsToOffset({ page: params.page, pageSize: params.pageSize })
      : { skip: params.skip ?? 0, limit: params.limit ?? 100 };
  return request({
    method: "GET",
    path: "/prompt-block/",
    query: offset,
    schema: PromptBlocksPublicSchema,
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
