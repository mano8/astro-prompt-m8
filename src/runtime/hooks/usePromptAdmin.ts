import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "../api/admin.js";
import { ForbiddenError } from "../errors.js";
import { promptKeys } from "../queryKeys.js";
import { usePromptContext } from "../react/PromptProvider.js";
import type { PromptAdminOverview } from "../api/admin.js";

export type UsePromptAdmin = {
  allowed: boolean;
  overview: PromptAdminOverview | null;
  loading: boolean;
  error: unknown;
  load: () => Promise<void>;
};

async function guardAdmin<T>(allowed: boolean, task: () => Promise<T>): Promise<T> {
  if (!allowed) throw new ForbiddenError();
  return task();
}

export function usePromptAdmin(): UsePromptAdmin {
  const { isSuperuser } = usePromptContext();
  const query = useQuery<PromptAdminOverview, unknown>({
    queryKey: promptKeys.adminOverview(),
    queryFn: () => guardAdmin(isSuperuser, getAdminOverview),
    enabled: false
  });
  const { refetch } = query;
  const load = useCallback(async () => {
    const result = await refetch();
    if (result.error) throw result.error;
  }, [refetch]);

  return {
    allowed: isSuperuser,
    overview: query.data ?? null,
    loading: query.isFetching,
    error: query.error ?? null,
    load
  };
}