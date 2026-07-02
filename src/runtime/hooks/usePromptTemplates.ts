import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult
} from "@tanstack/react-query";
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
  PromptTemplateUpdate,
  TemplateBlockPublic
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
type SetPositionVariables = { templateId: number; blockId: number; position: number };
type TemplateListSnapshot = [QueryKey, PromptTemplatesPublic | undefined];
type SetPositionContext = {
  templateLists: TemplateListSnapshot[];
  template: PromptTemplatePublic | undefined;
  templateBlocks: TemplateBlockPublic[] | undefined;
};

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

export function reorderTemplateBlocks(
  blocks: TemplateBlockPublic[],
  blockId: number,
  position: number
): TemplateBlockPublic[] {
  const ordered = [...blocks].sort((left, right) => left.position - right.position);
  const fromIndex = ordered.findIndex((block) => block.block_id === blockId);
  if (fromIndex === -1) return blocks;

  const exactIndex = ordered.findIndex((block) => block.position === position);
  const fallbackIndex = position < ordered[fromIndex].position ? fromIndex - 1 : fromIndex + 1;
  const toIndex = Math.max(0, Math.min(ordered.length - 1, exactIndex === -1 ? fallbackIndex : exactIndex));
  if (fromIndex === toIndex) return ordered;

  const positions = ordered.map((block) => block.position);
  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);

  return ordered.map((block, index) => ({ ...block, position: positions[index] ?? index + 1 }));
}

function updateTemplateBlockPosition(
  template: PromptTemplatePublic,
  variables: SetPositionVariables
): PromptTemplatePublic {
  if (template.id !== variables.templateId) return template;
  return {
    ...template,
    blocks: reorderTemplateBlocks(template.blocks, variables.blockId, variables.position)
  };
}

export function updateTemplateListBlockPosition(
  data: PromptTemplatesPublic | undefined,
  variables: SetPositionVariables
): PromptTemplatesPublic | undefined {
  if (!data) return data;
  return {
    ...data,
    data: data.data.map((template) => updateTemplateBlockPosition(template, variables))
  };
}

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
    SetPositionVariables,
    SetPositionContext
  >({
    mutationFn: ({ templateId, blockId, position }) =>
      setTemplateBlockPosition(templateId, blockId, position),
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: promptKeys.templateLists(), exact: false }),
        queryClient.cancelQueries({ queryKey: promptKeys.template(variables.templateId), exact: true }),
        queryClient.cancelQueries({
          queryKey: promptKeys.templateBlocks(variables.templateId),
          exact: true
        })
      ]);

      const templateLists = queryClient.getQueriesData<PromptTemplatesPublic>({
        queryKey: promptKeys.templateLists(),
        exact: false
      });
      const template = queryClient.getQueryData<PromptTemplatePublic>(
        promptKeys.template(variables.templateId)
      );
      const templateBlocks = queryClient.getQueryData<TemplateBlockPublic[]>(
        promptKeys.templateBlocks(variables.templateId)
      );

      queryClient.setQueriesData<PromptTemplatesPublic>(
        { queryKey: promptKeys.templateLists(), exact: false },
        (data) => updateTemplateListBlockPosition(data, variables)
      );
      queryClient.setQueryData<PromptTemplatePublic>(
        promptKeys.template(variables.templateId),
        (data) => (data ? updateTemplateBlockPosition(data, variables) : data)
      );
      queryClient.setQueryData<TemplateBlockPublic[]>(
        promptKeys.templateBlocks(variables.templateId),
        (data) => (data ? reorderTemplateBlocks(data, variables.blockId, variables.position) : data)
      );

      return { templateLists, template, templateBlocks };
    },
    onError: (_error, variables, context) => {
      for (const [key, data] of context?.templateLists ?? []) {
        queryClient.setQueryData(key, data);
      }
      queryClient.setQueryData(promptKeys.template(variables.templateId), context?.template);
      queryClient.setQueryData(
        promptKeys.templateBlocks(variables.templateId),
        context?.templateBlocks
      );
    },
    onSettled: async (_data, _error, variables) => {
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
