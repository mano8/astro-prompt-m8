import { request } from "../client.js";
import {
  assertPromptEngineM8Compatibility,
  getPromptEngineM8Compatibility,
  type PromptEngineM8Compatibility
} from "../compatibility.js";
import { ServiceMetaSchema, type ServiceMeta } from "../schemas.js";

/**
 * Read `{API_PREFIX}/meta`.
 *
 * Public and unauthenticated by contract (`auth_sdk_m8.controllers.meta`), so
 * no token is attached and `skipRefresh` keeps a 401 from dragging the auth
 * adapter into a refresh the call never needed.
 */
export function getServiceMeta(): Promise<ServiceMeta> {
  return request({
    method: "GET",
    path: "/meta",
    schema: ServiceMetaSchema,
    skipRefresh: true
  });
}

/**
 * Outcome of the session preflight.
 *
 * `status: "unknown"` covers both halves of "we could not tell": a `/meta` the
 * client could not reach (offline, CORS, a proxy that does not forward the
 * prefix) and a `/meta` that answered without contract or version metadata.
 * `unreachable` separates them for a caller that wants to word the two
 * differently; the preflight itself treats both as advisory.
 */
export type PromptEngineM8Preflight = PromptEngineM8Compatibility & {
  /** True when `GET /meta` itself failed, rather than answering incompatibly. */
  unreachable: boolean;
};

let sessionPreflight: Promise<PromptEngineM8Preflight> | null = null;

/**
 * Run the compatibility preflight against the live service, once per session.
 *
 * `H5`: `assertPromptEngineM8Compatibility` was fully built and fully tested by
 * the `A35`/`A36` wave and then called by nothing, so the guard never met a
 * running service. This is the call site. It is memoised on the module, so the
 * four views a host may mount at once ask `/meta` exactly once, and a consumer
 * that wants a fresh answer calls {@link resetPromptEngineM8Preflight}.
 *
 * It resolves rather than rejects. The assertion still runs — and its message is
 * what `reason` carries — but a plugin that throws on an unreachable `/meta`
 * would fail an optional integration closed on a *network* fault, which is not
 * what the guard is for. Surfacing the incompatibility is the caller's job; the
 * shipped skins render the shared `state-error` block.
 */
export function runPromptEngineM8Preflight(): Promise<PromptEngineM8Preflight> {
  sessionPreflight ??= getServiceMeta()
    .then((meta) => {
      try {
        // The guard runs at its declared strictness: an incompatible contract
        // and a `/meta` carrying no version metadata at all both throw here.
        return { ...assertPromptEngineM8Compatibility(meta), unreachable: false };
      } catch {
        // Same verdict, returned instead of thrown, so the caller can render it.
        return { ...getPromptEngineM8Compatibility(meta), unreachable: false };
      }
    })
    .catch(() => ({
      ...getPromptEngineM8Compatibility({}),
      unreachable: true,
      reason: "The prompt service did not answer GET /meta — its version could not be verified"
    }));
  return sessionPreflight;
}

/** Drop the memoised answer so the next call re-reads `/meta`. */
export function resetPromptEngineM8Preflight(): void {
  sessionPreflight = null;
}
