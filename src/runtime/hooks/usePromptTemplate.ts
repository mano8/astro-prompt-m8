import { useQuery } from "@tanstack/react-query";
import { getTemplateBlocks, getTemplate, getTemplateBySlug } from "../api/templates.js";
import { promptKeys } from "../queryKeys.js";
import type { PromptTemplatePublic, TemplateBlockPublic } from "../schemas.js";

type UsePromptTemplateParams = { templateId?: number } | { slug?: string };

export function usePromptTemplate(params: UsePromptTemplateParams) {
  const isId = "templateId" in params && params.templateId !== undefined;
  const isSlug = "slug" in params && params.slug !== undefined;
  const enabled = isId || isSlug;

  const queryKey = isId
    ? promptKeys.template((params as { templateId: number }).templateId)
    : isSlug
      ? promptKeys.templateSlug((params as { slug: string }).slug)
      : (["prompt", "template", "none"] as const);

  return useQuery<PromptTemplatePublic | null, unknown>({
    queryKey,
    queryFn: () => {
      if ("templateId" in params && params.templateId !== undefined) {
        return getTemplate(params.templateId);
      }
      if ("slug" in params && params.slug !== undefined) {
        return getTemplateBySlug(params.slug);
      }
      return Promise.resolve(null);
    },
    enabled
  });
}

export function usePromptTemplateBlocks(templateId: number | undefined): {
  blocks: TemplateBlockPublic[];
  loading: boolean;
  error: unknown;
} {
  const query = useQuery<TemplateBlockPublic[], unknown>({
    queryKey: promptKeys.templateBlocks(templateId ?? -1),
    queryFn: () => {
      if (templateId === undefined) return Promise.resolve([]);
      return getTemplateBlocks(templateId);
    },
    enabled: templateId !== undefined
  });
  return {
    blocks: query.data ?? [],
    loading: query.isFetching,
    error: query.error ?? null
  };
}