import { useQuery } from "@tanstack/react-query";
import { getActivityAll, getActivityCurrent } from "../api/dashboard.js";
import { promptKeys } from "../queryKeys.js";
import type { UsersActivity } from "../schemas.js";

export function usePromptDashboardActivity(scope: "all" | "current" = "all") {
  const queryKey =
    scope === "current" ? promptKeys.dashboardActivityCurrent() : promptKeys.dashboardActivity();
  return useQuery<UsersActivity, unknown>({
    queryKey,
    queryFn: () => (scope === "current" ? getActivityCurrent() : getActivityAll())
  });
}