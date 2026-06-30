import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  addTemplateBlock,
  createTemplate,
  deleteTemplate,
  listTemplates,
  removeTemplateBlock,
  setTemplateBlockPosition,
  updateTemplate
} from "../api/templates.js";
import { promptKeys } from "../queryKeys.js";
import type {
  PromptTemplateCreate,
  PromptTemplateListParams,
  PromptTemplatePublic,
  PromptTemplatesPublic,
  PromptTemplateUpdate
} from "../schemas.js";
import { usePromptContext } from "../react/PromptProvider.js";

type CreateMutation = UseMutationResult<PromptTemplatePublic, unknown, PromptTemplateCreate>;
type UpdateMutation = UseMutationResult<
  PromptTemplatePublic,
  unknown,
  { templateId: number; body: PromptTemplateUpdate }
>;
type DeleteMutation = UseMutationResult<void, unknown, number>;
type AddBlockMutation = UseMutationResult<
  unknown,
  unknown,
  { templateId: number; blockId: number; position?: number }
>;
type SetPositionMutation = UseMutationResult<
  unknown,
  unknown,
  { templateId: number; blockId: number; position: number }
>;
type RemoveBlockMutation = UseMutationResult<unknown, unknown, { templateId: number; blockId: number }>;

export type UsePromptTemplates = {
  data: PromptTemplatesPublic | undefined;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  createMutation: CreateMutation;
  updateMutation: UpdateMutation;
  deleteMutation: DeleteMutation;
  addBlockMutation: AddBlockMutation;
  setPositionMutation: SetPositionMutation;
  removeBlockMutation: RemoveBlockMutation;
};

export function usePromptTemplates(params: PromptTemplateListParams = {}): UsePromptTemplates {
  const queryClient = useQueryClient();
  const { isSuperuser } = usePromptContext();
  const queryKey = promptKeys.templates(params);

  const query = useQuery<PromptTemplatesPublic, unknown>({
    queryKey,
    queryFn: () => listTemplates(params),
    enabled: isSuperuser ? isSuperuser : true
  });

  const createMutation = useMutation<PromptTemplatePublic, unknown, PromptTemplateCreate>({
    mutationFn: createTemplate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptKeys.templateLists(), exact: false });
    }
  });

  const updateMutation = useMutation<
    PromptTemplatePublic,
    unknown,
    { templateId: number; body: PromptTemplateUpdate }
  >({
    mutationFn: ({ templateId, body }) => updateTemplate(templateId, body),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.templateLists(), exact: false }),
        queryClient.invalidateQueries({
          queryKey: promptKeys.template(variables.templateId),
          exact: true
        })
      ]);
    }
  });

  const deleteMutation = useMutation<void, unknown, number>({
    mutationFn: (templateId) => deleteTemplate(templateId).then(() => undefined),
    onSuccess: async (_data, templateId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.templateLists(), exact: false }),
        queryClient.invalidateQueries({ queryKey: promptKeys.template(templateId), exact: true })
      ]);
    }
  });

  const addBlockMutation = useMutation<
    unknown,
    unknown,
    { templateId: number; blockId: number; position?: number }
  >({
    mutationFn: ({ templateId, blockId, position }) =>
      addTemplateBlock(templateId, blockId, position ?? 0),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.templateLists(), exact: false }),
        queryClient.invalidateQueries({
          queryKey: promptKeys.template(variables.templateId),
          exact: true
        }),
        queryClient.invalidateQueries({
          queryKey: promptKeys.templateBlocks(variables.templateId),
          exact: true
        })
      ]);
    }
  });

  const setPositionMutation = useMutation<
    unknown,
    unknown,
    { templateId: number; blockId: number; position: number }
  >({
    mutationFn: ({ templateId, blockId, position }) =>
      setTemplateBlockPosition(templateId, blockId, position),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: promptKeys.template(variables.templateId),
          exact: true
        }),
        queryClient.invalidateQueries({
          queryKey: promptKeys.templateBlocks(variables.templateId),
          exact: true
        })
      ]);
    }
  });

  const removeBlockMutation = useMutation<
    unknown,
    unknown,
    { templateId: number; blockId: number }
  >({
    mutationFn: ({ templateId, blockId }) => removeTemplateBlock(templateId, blockId),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.templateLists(), exact: false }),
        queryClient.invalidateQueries({
          queryKey: promptKeys.template(variables.templateId),
          exact: true
        }),
        queryClient.invalidateQueries({
          queryKey: promptKeys.templateBlocks(variables.templateId),
          exact: true
        })
      ]);
    }
  });

  const refetch = query.refetch;
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    data: query.data,
    loading: query.isFetching,
    error: query.error ?? null,
    refresh,
    createMutation,
    updateMutation,
    deleteMutation,
    addBlockMutation,
    setPositionMutation,
    removeBlockMutation
  };
}