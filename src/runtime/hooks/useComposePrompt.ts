import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { composeTemplate } from "../api/templates.js";
import { promptKeys } from "../queryKeys.js";
import type { ComposedPrompt, DynamicBlock } from "../schemas.js";

type ComposeMutation = UseMutationResult<
  ComposedPrompt,
  unknown,
  { templateId: number; dynamicContent?: DynamicBlock[] }
>;

export type UseComposePrompt = {
  compose: (templateId: number, dynamicContent?: DynamicBlock[]) => Promise<ComposedPrompt>;
  composeMutation: ComposeMutation;
};

export function useComposePrompt(): UseComposePrompt {
  const queryClient = useQueryClient();

  const composeMutation = useMutation<
    ComposedPrompt,
    unknown,
    { templateId: number; dynamicContent?: DynamicBlock[] }
  >({
    mutationFn: ({ templateId, dynamicContent }) =>
      composeTemplate(templateId, dynamicContent ?? []),
    onSuccess: async (data, variables) => {
      queryClient.setQueryData(promptKeys.compose(variables.templateId), data);
    }
  });

  const { mutateAsync } = composeMutation;
  const compose = useCallback(
    (templateId: number, dynamicContent?: DynamicBlock[]) =>
      mutateAsync({ templateId, dynamicContent }),
    [mutateAsync]
  );

  return { compose, composeMutation };
}