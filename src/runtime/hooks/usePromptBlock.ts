import { useQuery } from "@tanstack/react-query";
import { getBlock, getBlockBySlug } from "../api/blocks.js";
import { promptKeys } from "../queryKeys.js";
import type { PromptBlockPublic } from "../schemas.js";

type UsePromptBlockParams = { blockId?: number } | { slug?: string };

export function usePromptBlock(params: UsePromptBlockParams) {
  const queryKey =
    "blockId" in params && params.blockId !== undefined
      ? promptKeys.block(params.blockId)
      : "slug" in params && params.slug !== undefined
        ? promptKeys.blockSlug(params.slug)
        : ["prompt", "block", "none"] as const;

  return useQuery<PromptBlockPublic | null, unknown>({
    queryKey,
    queryFn: () => {
      if ("blockId" in params && params.blockId !== undefined) {
        return getBlock(params.blockId);
      }
      if ("slug" in params && params.slug !== undefined) {
        return getBlockBySlug(params.slug);
      }
      return Promise.resolve(null);
    },
    enabled:
      ("blockId" in params && params.blockId !== undefined) ||
      ("slug" in params && params.slug !== undefined)
  });
}