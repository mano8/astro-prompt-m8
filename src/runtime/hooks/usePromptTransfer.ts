import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  exportBlockById,
  exportTemplateById,
  importPromptExport,
  type ImportResult
} from "../api/transfer.js";
import { promptKeys } from "../queryKeys.js";
import type { PromptExport } from "../schemas.js";

type ExportBlockMutation = UseMutationResult<PromptExport, unknown, number>;
type ExportTemplateMutation = UseMutationResult<PromptExport, unknown, number>;
type ImportMutation = UseMutationResult<ImportResult, unknown, unknown>;

export type UsePromptTransfer = {
  exportBlockMutation: ExportBlockMutation;
  exportTemplateMutation: ExportTemplateMutation;
  importMutation: ImportMutation;
};

/**
 * Mutations for exporting a block/template to a portable payload and importing
 * a payload into the current account. Import invalidates block and template
 * lists so freshly imported items appear without a manual refresh.
 */
export function usePromptTransfer(): UsePromptTransfer {
  const queryClient = useQueryClient();

  const exportBlockMutation = useMutation<PromptExport, unknown, number>({
    mutationFn: (blockId) => exportBlockById(blockId)
  });

  const exportTemplateMutation = useMutation<PromptExport, unknown, number>({
    mutationFn: (templateId) => exportTemplateById(templateId)
  });

  const importMutation = useMutation<ImportResult, unknown, unknown>({
    mutationFn: (input) => importPromptExport(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promptKeys.blockLists(), exact: false }),
        queryClient.invalidateQueries({ queryKey: promptKeys.templateLists(), exact: false })
      ]);
    }
  });

  return { exportBlockMutation, exportTemplateMutation, importMutation };
}
