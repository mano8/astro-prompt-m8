import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { createBlock, deleteBlock, listBlocks, updateBlock } from "../api/blocks.js";
import { promptKeys } from "../queryKeys.js";
import type {
  PromptBlockCreate,
  PromptBlockListParams,
  PromptBlockPublic,
  PromptBlocksPublic,
  PromptBlockUpdate
} from "../schemas.js";
import { usePromptContext } from "../react/PromptProvider.js";

type ListResult = {
  data: PromptBlocksPublic | undefined;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
};
type CreateMutation = UseMutationResult<PromptBlockPublic, unknown, PromptBlockCreate>;
type UpdateMutation = UseMutationResult<
  PromptBlockPublic,
  unknown,
  { blockId: number; body: PromptBlockUpdate }
>;
type DeleteMutation = UseMutationResult<void, unknown, number>;

export type UsePromptBlocks = ListResult & {
  createMutation: CreateMutation;
  updateMutation: UpdateMutation;
  deleteMutation: DeleteMutation;
};

export function usePromptBlocks(params: PromptBlockListParams = {}): UsePromptBlocks {
  const queryClient = useQueryClient();
  const { isSuperuser } = usePromptContext();
  const queryKey = promptKeys.blocks(params);

  const query = useQuery<PromptBlocksPublic, unknown>({
    queryKey,
    queryFn: () => listBlocks(params),
    enabled: isSuperuser ? isSuperuser : true
  });

  const createMutation = useMutation<PromptBlockPublic, unknown, PromptBlockCreate>({
    mutationFn: (body) => createBlock(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptKeys.blockLists(), exact: false });
    }
  });

  const updateMutation = useMutation<
    PromptBlockPublic,
    unknown,
    { blockId: number; body: PromptBlockUpdate }
  >({
    mutationFn: ({ blockId, body }) => updateBlock(blockId, body),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.blockLists(), exact: false }),
        queryClient.invalidateQueries({ queryKey: promptKeys.block(variables.blockId), exact: true })
      ]);
    }
  });

  const deleteMutation = useMutation<void, unknown, number>({
    mutationFn: (blockId) => deleteBlock(blockId).then(() => undefined),
    onSuccess: async (_data, blockId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.blockLists(), exact: false }),
        queryClient.invalidateQueries({ queryKey: promptKeys.block(blockId), exact: true })
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
    deleteMutation
  };
}