import type { ReactNode } from "react";
import { usePromptContext } from "./PromptProvider.js";

/** Render children only when the auth adapter reports a superuser. */
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