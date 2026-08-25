import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  exportBlockById,
  exportFilteredBlocks,
  exportFilteredTemplates,
  exportTemplateById,
  importPromptExport,
  type FilteredExportResult,
  type ImportResult
} from "../api/transfer.js";
import { promptKeys } from "../queryKeys.js";
import type {
  PromptBlockListParams,
  PromptExport,
  PromptTemplateListParams
} from "../schemas.js";

type ExportBlockMutation = UseMutationResult<PromptExport, unknown, number>;
type ExportTemplateMutation = UseMutationResult<PromptExport, unknown, number>;
type ExportFilteredBlocksMutation = UseMutationResult<
  FilteredExportResult,
  unknown,
  Omit<PromptBlockListParams, "skip" | "limit" | "page" | "pageSize"> | void
>;
type ExportFilteredTemplatesMutation = UseMutationResult<
  FilteredExportResult,
  unknown,
  Omit<PromptTemplateListParams, "skip" | "limit" | "page" | "pageSize"> | void
>;
type ImportMutation = UseMutationResult<ImportResult, unknown, unknown>;

export type UsePromptTransfer = {
  exportBlockMutation: ExportBlockMutation;
  exportTemplateMutation: ExportTemplateMutation;
  /** True bulk export over the filtered set (`A-C8`), not one fetched page. */
  exportFilteredBlocksMutation: ExportFilteredBlocksMutation;
  /** True bulk export over the filtered set (`A-C8`), not one fetched page. */
  exportFilteredTemplatesMutation: ExportFilteredTemplatesMutation;
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

  const exportFilteredBlocksMutation: ExportFilteredBlocksMutation = useMutation({
    mutationFn: (params) => exportFilteredBlocks(params ?? {})
  });

  const exportFilteredTemplatesMutation: ExportFilteredTemplatesMutation = useMutation({
    mutationFn: (params) => exportFilteredTemplates(params ?? {})
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

  return {
    exportBlockMutation,
    exportTemplateMutation,
    exportFilteredBlocksMutation,
    exportFilteredTemplatesMutation,
    importMutation
  };
}
