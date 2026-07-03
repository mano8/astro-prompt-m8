import { request } from "../client.js";
import { unwrap, unwrapOrNull } from "./blocks.js";
import {
  ComposedPromptSchema,
  PromptTemplatePublicSchema,
  PromptTemplatesPublicSchema,
  ResponseMessageSchema,
  ResponseModelBaseSchema,
  TemplateBlockPublicSchema,
  type ComposedPrompt,
  type DynamicBlock,
  type PromptTemplateCreate,
  type PromptTemplateListParams,
  type PromptTemplatePublic,
  type PromptTemplateUpdate,
  type PromptTemplatesPublic,
  type ResponseMessage,
  type ResponseModelBase,
  type TemplateBlockPublic
} from "../schemas.js";

const ModelOrMessage = ResponseModelBaseSchema.or(ResponseMessageSchema);

export async function listTemplates(
  params: PromptTemplateListParams = {}
): Promise<PromptTemplatesPublic> {
  return request({
    method: "GET",
    path: "/prompt-template/",
    query: { skip: params.skip ?? 0, limit: params.limit ?? 100 },
    schema: PromptTemplatesPublicSchema,
    auth: true
  });
}

export async function getTemplate(templateId: number): Promise<PromptTemplatePublic> {
  return unwrap(
    await request<ResponseModelBase>({
      method: "GET",
      path: `/prompt-template/get/${templateId}/`,
      schema: ResponseModelBaseSchema,
      auth: true
    })
  );
}

export async function getTemplateBySlug(slug: string): Promise<PromptTemplatePublic | null> {
  return unwrapOrNull(
    await request<ResponseModelBase | ResponseMessage>({
      method: "GET",
      path: `/prompt-template/get_by_slug/${encodeURIComponent(slug)}/`,
      schema: ModelOrMessage,
      auth: true
    })
  );
}

export async function getTemplateBlocks(
  templateId: number
): Promise<TemplateBlockPublic[]> {
  const body = await request<ResponseModelBase | ResponseMessage>({
    method: "GET",
    path: `/prompt-template/get-blocks/${templateId}/`,
    schema: ModelOrMessage,
    auth: true
  });
  if ("data" in body && Array.isArray(body.data)) {
    return TemplateBlockPublicSchema.array().parse(body.data);
  }
  return [];
}

/** Composes dynamic-content payload and parses a ComposedPrompt response. */
export async function composeTemplate(
  templateId: number,
  dynamicContent: DynamicBlock[] = []
): Promise<ComposedPrompt> {
  const body = await request<ResponseModelBase | ResponseMessage>({
    method: "POST",
    path: `/prompt-template/compose/${templateId}/`,
    body: dynamicContent,
    schema: ModelOrMessage,
    auth: true
  });
  if ("data" in body && body.data) {
    return ComposedPromptSchema.parse(body.data);
  }
  return { content: "" };
}

export async function createTemplate(
  body: PromptTemplateCreate
): Promise<PromptTemplatePublic> {
  return unwrap(
    await request<ResponseModelBase>({
      method: "POST",
      path: "/prompt-template/add/",
      body,
      schema: ResponseModelBaseSchema,
      auth: true
    })
  );
}

export async function updateTemplate(
  templateId: number,
  body: PromptTemplateUpdate
): Promise<PromptTemplatePublic> {
  return unwrap(
    await request<ResponseModelBase>({
      method: "PUT",
      path: `/prompt-template/edit/${templateId}/`,
      body,
      schema: ResponseModelBaseSchema,
      auth: true
    })
  );
}

export async function deleteTemplate(templateId: number): Promise<ResponseMessage> {
  return request({
    method: "DELETE",
    path: `/prompt-template/delete/${templateId}/`,
    schema: ResponseMessageSchema,
    auth: true
  });
}

export async function addTemplateBlock(
  templateId: number,
  blockId: number,
  position = 0
): Promise<ResponseModelBase> {
  return request({
    method: "GET",
    path: `/prompt-template/${templateId}/add-block/${blockId}/`,
    query: { position },
    schema: ResponseModelBaseSchema,
    auth: true
  });
}

export async function setTemplateBlockPosition(
  templateId: number,
  blockId: number,
  position = 1
): Promise<ResponseModelBase> {
  return request({
    method: "GET",
    path: `/prompt-template/${templateId}/set-block-position/${blockId}/`,
    query: { position },
    schema: ResponseModelBaseSchema,
    auth: true
  });
}

export async function removeTemplateBlock(
  templateId: number,
  blockId: number
): Promise<ResponseMessage> {
  return request({
    method: "DELETE",
    path: `/prompt-template/${templateId}/delete-block/${blockId}/`,
    schema: ResponseMessageSchema,
    auth: true
  });
}