import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult
} from "@tanstack/react-query";
import { useCallback } from "react";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory
} from "../api/categories.js";
import { promptKeys } from "../queryKeys.js";
import type {
  CategoriesPublic,
  CategoryCreate,
  CategoryListParams,
  CategoryPublic,
  CategoryUpdate
} from "../schemas.js";

type CreateMutation = UseMutationResult<CategoryPublic, unknown, CategoryCreate>;
type UpdateMutation = UseMutationResult<
  CategoryPublic,
  unknown,
  { categoryId: number; body: CategoryUpdate }
>;
type DeleteMutation = UseMutationResult<void, unknown, number>;

export type UsePromptCategories = {
  data: CategoriesPublic | null | undefined;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  createMutation: CreateMutation;
  updateMutation: UpdateMutation;
  deleteMutation: DeleteMutation;
};

export function usePromptCategories(params: CategoryListParams = {}): UsePromptCategories {
  const queryClient = useQueryClient();
  const queryKey = promptKeys.categories(params);

  const query = useQuery<CategoriesPublic | null, unknown>({
    queryKey,
    queryFn: () => listCategories(params)
  });

  const createMutation = useMutation<CategoryPublic, unknown, CategoryCreate>({
    mutationFn: createCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: promptKeys.categoryLists(), exact: false });
    }
  });

  const updateMutation = useMutation<
    CategoryPublic,
    unknown,
    { categoryId: number; body: CategoryUpdate }
  >({
    mutationFn: ({ categoryId, body }) => updateCategory(categoryId, body),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.categoryLists(), exact: false }),
        queryClient.invalidateQueries({
          queryKey: promptKeys.category(variables.categoryId),
          exact: true
        })
      ]);
    }
  });

  const deleteMutation = useMutation<void, unknown, number>({
    mutationFn: (categoryId) => deleteCategory(categoryId).then(() => undefined),
    onSuccess: async (_data, categoryId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.categoryLists(), exact: false }),
        queryClient.invalidateQueries({ queryKey: promptKeys.category(categoryId), exact: true })
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