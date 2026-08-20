// Headless standalone smoke for the published tarball (`C10`).
//
// This file is compiled *and executed* against an installed
// `@mano8/astro-prompt-m8`, in a throwaway directory that has no workspace
// checkout above it — which is the whole point: `STANDALONE-CHILD-USABILITY`
// says the child must work with nothing but its own tarball. It deliberately
// touches only the headless subpaths, so it needs no React, no Astro and no
// running service.
import {
  assertPromptEngineM8Compatibility,
  getPromptEngineM8Compatibility,
  PROMPT_ENGINE_M8_CONTRACT,
  PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE
} from "@mano8/astro-prompt-m8/compatibility";
import {
  CategoryCreateSchema,
  PromptBlockListParamsSchema,
  ServiceMetaSchema,
  promptBlockSortFields
} from "@mano8/astro-prompt-m8/schemas";
import { toServiceListQuery } from "@mano8/astro-prompt-m8/list-params";
import { getServiceMeta, runPromptEngineM8Preflight } from "@mano8/astro-prompt-m8/api";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[tarball-consumer] ${message}`);
}

// The contract the package declares must match what package.json publishes,
// or a consumer's compatibility check is asserting against a stale constant.
assert(
  PROMPT_ENGINE_M8_CONTRACT === "prompt-engine-m8@2.0.0",
  `unexpected contract: ${PROMPT_ENGINE_M8_CONTRACT}`
);
assert(
  PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE === ">=2.0.0 <3.0.0",
  `unexpected service range: ${PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE}`
);

// A real `{API_PREFIX}/meta` payload parses, and the guard blesses it.
const meta = ServiceMetaSchema.parse({
  service: "prompt-engine-m8",
  version: "2.0.0",
  api_version: "v1",
  contract: { name: "prompt-engine-m8", version: "2.0.0", range: ">=2.0.0 <3.0.0" }
});
assert(
  assertPromptEngineM8Compatibility(meta).status === "compatible",
  "the live-shaped /meta payload was not judged compatible"
);

// A sibling M8 service serves the same payload shape at the same path; the
// guard has to name it rather than bless it on a matching version.
assert(
  getPromptEngineM8Compatibility({
    ...meta,
    contract: { name: "media-service-m8", version: "2.0.0", range: ">=2.0.0 <3.0.0" }
  }).status === "incompatible",
  "a sibling service's /meta was not rejected"
);

// `H2`: `type` is required, `slug` is refused (the service derives it).
assert(
  CategoryCreateSchema.safeParse({ name: "x", type: "prompt_block" }).success,
  "a valid category create payload was rejected"
);
assert(
  !CategoryCreateSchema.safeParse({ name: "x" }).success,
  "a category create without `type` was accepted"
);

// The list vocabulary survives the build and reaches the wire helper.
assert(
  promptBlockSortFields.includes("is_dynamic"),
  "the declared block sort vocabulary is missing a service column"
);
const query = toServiceListQuery(
  PromptBlockListParamsSchema.parse({ page: 2, pageSize: 10, q: "hello", sort: "" })
);
assert(query.skip === 10 && query.limit === 10, "page/pageSize did not become skip/limit");
assert(query.q === "hello", "the search term did not reach the query");
assert(query.sort === undefined, "a blank sort was sent instead of being read as absent");

// The api surface is callable (not called — there is no service here).
assert(typeof getServiceMeta === "function", "the /meta wrapper is not exported");
assert(
  typeof runPromptEngineM8Preflight === "function",
  "the session preflight is not exported"
);

console.log("[tarball-consumer] installed package passed the headless smoke");
