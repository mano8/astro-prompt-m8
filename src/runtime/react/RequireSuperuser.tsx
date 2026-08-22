import type { ReactNode } from "react";
import { usePromptContext } from "./PromptProvider.js";

/**
 * Render children only when the auth adapter grants admin access.
 *
 * "Admin access" is whatever `adminRole` declares — since `D-C2` a role at or
 * above `admin`, matching the service's `require_admin` floor — plus an explicit
 * `is_superuser` flag. The export keeps its name for consumers that already
 * import it.
 */
export function RequireSuperuser({
  children,
  fallback = null
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isSuperuser, loading } = usePromptContext();
  if (loading) return null;
  return <>{isSuperuser ? children : fallback}</>;
}