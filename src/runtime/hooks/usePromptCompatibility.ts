import { usePromptContext } from "../react/PromptProvider.js";
import type { PromptEngineM8Preflight } from "../api/meta.js";

export type UsePromptCompatibility = {
  /** `null` until the once-per-session `GET /meta` preflight resolves. */
  result: PromptEngineM8Preflight | null;
  /** True while the preflight is still in flight. */
  loading: boolean;
  /** True only for a service that answered and answered wrong. */
  incompatible: boolean;
  /** Human-readable reason, when there is one to show. */
  reason?: string;
};

/**
 * Read the session compatibility preflight (`H5`).
 *
 * `incompatible` is deliberately narrower than `status !== "compatible"`: an
 * unreachable `/meta` and a `/meta` without version metadata both leave the
 * question open, and blocking a working UI on "we could not tell" would trade a
 * silent mismatch for a loud outage. Only a service that answered, and answered
 * with the wrong contract or the wrong version, is reported as incompatible.
 */
export function usePromptCompatibility(): UsePromptCompatibility {
  const { compatibility } = usePromptContext();
  return {
    result: compatibility,
    loading: compatibility === null,
    incompatible: compatibility?.status === "incompatible",
    reason: compatibility?.reason
  };
}
