/**
 * Contract-drift detector (`A-C1`).
 *
 * Diffs this plugin's Zod surface and its pinned service range against
 * `prompt-engine-m8`'s published OpenAPI document. `H1` (a typed list-param
 * surface the api wrapper dropped on the floor), `H2` (`CategoryCreate` missing
 * the `type` the service requires) and `H6` (`vsrc` declared on the wire types
 * and answered by no route) would each have been caught here, at the diff,
 * instead of by reading source on both sides of a wire.
 *
 * The document comes from, in order of precedence:
 *
 *   --openapi <path|url>          explicit, wins over everything
 *   PROMPT_ENGINE_M8_OPENAPI      same, from the environment
 *   contracts/prompt-engine-m8.openapi.json   the vendored copy (default)
 *
 * The vendored copy is what makes this runnable standalone
 * (`STANDALONE-CHILD-USABILITY`): no network, no sibling checkout, no parent
 * workspace. It is a *copy*, so it bounds what the gate can see to the service
 * as of the last refresh — pointing `--openapi` at a live `{base}/openapi.json`
 * or at `prompt-engine-m8/contracts/openapi.json` closes that loop, and
 * `--write` refreshes the copy from whatever source was read.
 *
 * Reads the built package (`dist/`), not the TypeScript sources: the schemas
 * are probed by *running* them — `safeParse` against samples generated from the
 * published document — rather than by introspecting Zod internals, so the gate
 * survives a Zod release and asks the only question that matters, which is
 * whether a payload the service publishes is one this client accepts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist", "src", "runtime");

const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));

/** Declared beside the version pins it belongs with, in `promptEngineM8`. */
const VENDORED = join(ROOT, packageJson.promptEngineM8?.openapi ?? "contracts/prompt-engine-m8.openapi.json");

const failures = [];
const notices = [];

const fail = (check, message) => failures.push({ check, message });
const note = (check, message) => notices.push({ check, message });

// ---------------------------------------------------------------------------
// The contract map.
//
// Every entry below is a claim about the other side of the wire, written down
// once so a drift report can name the pair that moved. An unmapped published
// component is a failure, not a gap: a model appearing in the service is the
// event this gate exists to surface.
// ---------------------------------------------------------------------------

/** Parameters this client knows how to put in a list query. */
const KNOWN_LIST_PARAMS = ["skip", "limit", "page", "pageSize", "q", "csrc", "sort", "order", "f", "vsrc"];

/** Client-only parameters: translated before the wire, never sent verbatim. */
const LOCAL_ONLY_LIST_PARAMS = new Set(["page", "pageSize"]);

/**
 * Parameters that must not be accepted at all. `vsrc` is `H6`: the URL-state
 * helper has such a field, the service declares no such parameter, and the
 * request schemas must keep refusing to carry it onto the wire.
 */
const FORBIDDEN_LIST_PARAMS = new Set(["vsrc"]);

const LIST_ENDPOINTS = [
  {
    path: "/prompt-block/",
    schema: "PromptBlockListParamsSchema",
    vocabulary: { csrc: "promptBlockSearchFields", sort: "promptBlockSortFields", f: "promptBlockFacets" },
  },
  {
    path: "/prompt-template/",
    schema: "PromptTemplateListParamsSchema",
    vocabulary: {
      csrc: "promptTemplateSearchFields",
      sort: "promptTemplateSortFields",
      f: "promptTemplateFacets",
    },
  },
  {
    path: "/category/",
    schema: "CategoryListParamsSchema",
    // `/category/` publishes no `csrc` and no `f`. The emptiness is contract.
    vocabulary: { sort: "categorySortFields" },
  },
];

/**
 * Request bodies. `narrowed` records a published property this client refuses
 * on purpose; a narrowing without a reason here is a failure, so "we dropped a
 * field" can never pass as "we meant to".
 */
const REQUEST_BODIES = [
  { method: "POST", path: "/prompt-block/add/", schema: "PromptBlockCreateSchema" },
  { method: "PUT", path: "/prompt-block/edit/{}/", schema: "PromptBlockUpdateSchema" },
  { method: "POST", path: "/prompt-template/add/", schema: "PromptTemplateCreateSchema" },
  { method: "PUT", path: "/prompt-template/edit/{}/", schema: "PromptTemplateUpdateSchema" },
  {
    method: "POST",
    path: "/category/add/",
    schema: "CategoryCreateSchema",
    narrowed: {
      slug: "the service derives slug from name in a before-validator and overwrites whatever a caller sends, so offering the field would publish a knob that does nothing",
    },
  },
  {
    method: "PUT",
    path: "/category/edit/{}/",
    schema: "CategoryUpdateSchema",
    narrowed: {
      slug: "same derived-slug narrowing as POST /category/add/ — the service reuses CategoryCreate for the edit body",
    },
  },
];

/**
 * Published *response* component ↔ the Zod schema this client parses it with.
 *
 * Response models only. A request model is checked in the other direction — by
 * what the client must be able to *send* — and that is `REQUEST_BODIES`.
 */
const MODELS = {
  PromptBlockPublic: "PromptBlockPublicSchema",
  PromptBlocksPublic: "PromptBlocksPublicSchema",
  PromptBlocksExport: "PromptBlocksExportSchema",
  PromptTemplateDict: "PromptTemplatePublicSchema",
  PromptTemplatesList: "PromptTemplatesPublicSchema",
  PromptTemplatesExport: "PromptTemplatesExportSchema",
  TemplateBlockDict: "TemplateBlockPublicSchema",
  CategoryPublic: "CategoryPublicSchema",
  CategoriesPublic: "CategoriesPublicSchema",
  ServiceMeta: "ServiceMetaSchema",
  ServiceContract: "ServiceContractSchema",
  ResponseModelBase: "ResponseModelBaseSchema",
  ResponseMessage: "ResponseMessageSchema",
  UsersActivity: "UsersActivitySchema",
  ActivityStats: "ActivityStatsSchema",
  ActivityCounter: "ActivityCounterSchema",
};

/** Published components this client deliberately does not model here, and why. */
const UNMODELLED = {
  PromptBlockModel: "request body — checked by REQUEST_BODIES, which asks the send-side question",
  PromptTemplateModel: "request body — checked by REQUEST_BODIES",
  CategoryCreate: "request body — checked by REQUEST_BODIES",
  CategoryUpdate: "request body — checked by REQUEST_BODIES",
  DynamicBlock: "compose request body; sent as a bare array, so it has no operation-level required set to diff",
  HTTPValidationError: "FastAPI's 422 envelope — surfaced as a thrown api error, never parsed as a domain model",
  ValidationError: "a member of HTTPValidationError, same reason",
  ResponseError: "error envelope; the client reads status and message, not a typed body",
  ResponseErrorBase: "same as ResponseError",
  CategoryType: "enum component, checked through the models that reference it",
  PromptBlockType: "enum component, checked through the models that reference it",
  CategorySortField: "list vocabulary, checked against the mirrored constants above",
  ListSortOrder: "list vocabulary, checked against the mirrored constants above",
  PromptBlockSearchField: "list vocabulary, checked against the mirrored constants above",
  PromptBlockSortField: "list vocabulary, checked against the mirrored constants above",
  PromptTemplateSearchField: "list vocabulary, checked against the mirrored constants above",
  PromptTemplateSortField: "list vocabulary, checked against the mirrored constants above",
};

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { openapi: process.env.PROMPT_ENGINE_M8_OPENAPI ?? null, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--openapi") {
      args.openapi = argv[index + 1];
      index += 1;
    } else if (arg.startsWith("--openapi=")) {
      args.openapi = arg.slice("--openapi=".length);
    } else if (arg === "--write") {
      args.write = true;
    } else {
      console.error(`[verify-contract-drift] unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

async function loadDocument(source) {
  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`GET ${source} answered ${response.status}`);
    }
    return { text: await response.text(), origin: source };
  }
  const path = resolve(ROOT, source);
  if (!existsSync(path)) {
    throw new Error(
      `${path} does not exist. Refresh it from the service with ` +
        "`node scripts/verify-contract-drift.mjs --openapi <url|path> --write`.",
    );
  }
  return { text: readFileSync(path, "utf-8"), origin: path };
}

async function loadRuntime() {
  const entry = join(DIST, "schemas.js");
  if (!existsSync(entry)) {
    console.error("[verify-contract-drift] dist/ is missing — run `npm run build` first.");
    console.error("  The gate probes the built schemas by running them, so there is nothing to probe yet.");
    process.exit(1);
  }
  const [schemas, listParams, compatibility] = await Promise.all([
    import(pathToFileURL(entry).href),
    import(pathToFileURL(join(DIST, "listParams.js")).href),
    import(pathToFileURL(join(DIST, "compatibility.js")).href),
  ]);
  return { schemas, listParams, compatibility };
}

// ---------------------------------------------------------------------------
// Sample generation — build an instance of a published schema
// ---------------------------------------------------------------------------

function deref(document, node, depth = 0) {
  let current = node;
  let hops = 0;
  while (current && typeof current.$ref === "string") {
    if (hops > 8) throw new Error(`$ref cycle at depth ${depth}`);
    const name = current.$ref.split("/").pop();
    current = document.components?.schemas?.[name];
    hops += 1;
  }
  return current ?? {};
}

function pickBranch(schema) {
  const branches = schema.anyOf ?? schema.oneOf;
  if (!branches) return schema;
  const concrete = branches.find((branch) => branch.type !== "null");
  return concrete ?? branches[0];
}

/**
 * An instance of `schema` that satisfies its published constraints.
 *
 * `mode: "required"` builds the minimal object — exactly the properties the
 * document marks required — which is the payload a client that mirrors the
 * contract must be able to send. `mode: "all"` builds the maximal one, which
 * is the payload a client must be able to *receive*.
 */
function sample(document, node, mode, depth = 0) {
  if (depth > 8) return null;
  // Deref on both sides of the branch pick: an optional enum parameter is
  // published as `anyOf: [$ref, null]`, so the values are one level down from
  // the branch, not from the parameter.
  const schema = deref(document, pickBranch(deref(document, node, depth)), depth);

  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (schema.const !== undefined) return schema.const;
  // `default` is deliberately not a shortcut. `q` and `f` both default to the
  // empty string, and a blank is what the service reads as *absent* — sampling
  // the default would probe the one value that proves nothing.

  const type = Array.isArray(schema.type) ? schema.type.find((one) => one !== "null") : schema.type;

  switch (type) {
    case "string": {
      if (schema.format === "date-time") return "2026-01-01T00:00:00Z";
      if (schema.format === "uuid") return "00000000-0000-4000-8000-000000000000";
      const min = Math.max(schema.minLength ?? 1, 1);
      const max = schema.maxLength ?? min;
      return "x".repeat(Math.max(1, Math.min(min, max)));
    }
    case "integer":
    case "number": {
      const exclusive = schema.exclusiveMinimum;
      const floor = exclusive !== undefined ? Number(exclusive) + 1 : (schema.minimum ?? 1);
      const ceiling = schema.maximum ?? floor;
      return Math.min(floor, ceiling);
    }
    case "boolean":
      return true;
    case "array":
      return [sample(document, schema.items ?? {}, mode, depth + 1)];
    case "null":
      return null;
    case "object":
    default: {
      const properties = schema.properties;
      if (!properties) return type === "object" ? {} : "x";
      const required = new Set(schema.required ?? []);
      const result = {};
      for (const [name, property] of Object.entries(properties)) {
        if (mode === "required" && !required.has(name)) continue;
        result[name] = sample(document, property, mode, depth + 1);
      }
      return result;
    }
  }
}

// ---------------------------------------------------------------------------
// Document helpers
// ---------------------------------------------------------------------------

/** Structural path key: `/x/{item_id}/` and `` `/x/${id}/` `` are the same route. */
function pathShape(path) {
  return path.replace(/\{[^}]*\}/g, "{}");
}

function buildPathIndex(document) {
  const index = new Map();
  let prefix = null;
  for (const path of Object.keys(document.paths ?? {})) {
    const segments = path.split("/");
    prefix = prefix === null ? segments[1] : prefix === segments[1] ? prefix : "";
  }
  const apiPrefix = prefix ? `/${prefix}` : "";
  for (const [path, operations] of Object.entries(document.paths ?? {})) {
    const relative = apiPrefix && path.startsWith(apiPrefix) ? path.slice(apiPrefix.length) : path;
    index.set(pathShape(relative), { path, operations });
  }
  return { index, apiPrefix };
}

function operationFor(pathIndex, method, path) {
  const entry = pathIndex.index.get(pathShape(path));
  if (!entry) return null;
  return entry.operations[method.toLowerCase()] ?? null;
}

function queryParameters(operation) {
  return Object.fromEntries(
    (operation.parameters ?? [])
      .filter((parameter) => parameter.in === "query")
      .map((parameter) => [parameter.name, parameter]),
  );
}

function publishedEnum(document, parameter) {
  const schema = deref(document, pickBranch(parameter.schema ?? {}));
  return Array.isArray(schema.enum) ? schema.enum : null;
}

/**
 * Facet values reach the document through the `f` description: the parameter
 * carries several values in one string, so its type cannot be an enum. The
 * service publishes them as `Allowed: a, b, c.` and its own contract-fidelity
 * tests assert that; this reads the same sentence.
 */
function publishedFacets(parameter) {
  const match = /Allowed:\s*([^.]+)\./.exec(parameter.description ?? "");
  return match ? match[1].split(",").map((value) => value.trim()) : null;
}

/**
 * A value this parameter is published as accepting.
 *
 * `f` is the case a generic sampler cannot reach: it is typed `string`, and its
 * vocabulary lives in the description, so a sampled `"x"` would be an
 * undeclared facet — a value the *service* rejects, which would make the probe
 * measure the sampler instead of the contract.
 */
function parameterSample(document, parameter) {
  const facets = publishedFacets(parameter);
  if (facets && facets.length > 0) return facets[0];
  const values = publishedEnum(document, parameter);
  if (values && values.length > 0) return values[0];
  return sample(document, parameter.schema ?? {}, "all");
}

function requestBodySchema(operation) {
  return operation.requestBody?.content?.["application/json"]?.schema ?? null;
}

/** The `{method, path}` pairs the api wrappers actually call. */
function callSites() {
  const dir = join(ROOT, "src", "runtime", "api");
  const files = ["admin.ts", "blocks.ts", "categories.ts", "dashboard.ts", "internal.server.ts", "meta.ts", "templates.ts"];
  // Scanned line by line rather than with one multi-line pattern: the api
  // wrappers write `method`, `path` and `query` as consecutive properties, and
  // three anchored patterns read that shape without the backtracking a single
  // cross-line alternation would carry over whole source files.
  const METHOD = /^\s*method:\s*"([A-Z]+)",\s*$/;
  const PATH = /^\s*path:\s*(?:"([^"]+)"|`([^`]+)`),\s*$/;
  const QUERY = /^\s*query:\s*\{([^}]*)\},\s*$/;
  const calls = [];
  for (const file of files) {
    const path = join(dir, file);
    if (!existsSync(path)) {
      fail("call-sites", `src/runtime/api/${file} is gone — the call-site scan is reading a stale file list.`);
      continue;
    }
    const lines = readFileSync(path, "utf-8").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const method = METHOD.exec(lines[index]);
      if (!method) continue;
      const target = PATH.exec(lines[index + 1] ?? "");
      if (!target) {
        fail(
          "call-sites",
          `src/runtime/api/${file}:${index + 1} declares \`method: "${method[1]}"\` with no \`path\` on the ` +
            "next line; the call-site scan cannot read it.",
        );
        continue;
      }
      const bag = QUERY.exec(lines[index + 2] ?? "");
      calls.push({
        file,
        method: method[1],
        // `${...}` is a path parameter wherever it appears.
        path: (target[1] ?? target[2]).replace(/\$\{[^}]*\}/g, "{}"),
        query: bag
          ? bag[1]
              .split(",")
              .map((entry) => entry.split(":")[0].trim())
              .filter((name) => /^[a-zA-Z_]\w*$/.test(name))
          : [],
      });
    }
  }
  if (calls.length === 0) {
    fail("call-sites", "the api call-site scan matched nothing; its pattern no longer fits src/runtime/api/**.");
  }
  return calls;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkVersionPin(document, packageJson, compatibility) {
  const pins = packageJson.promptEngineM8 ?? {};
  const served = document.info?.version;
  const title = document.info?.title;

  if (title !== compatibility.PROMPT_ENGINE_M8_CONTRACT_ID) {
    fail(
      "version-pin",
      `the document is titled "${title}" — this client pins the ` +
        `"${compatibility.PROMPT_ENGINE_M8_CONTRACT_ID}" contract, so it is reading the wrong service.`,
    );
    return;
  }

  if (!served || !compatibility.isPromptEngineM8ServiceVersionCompatible(served)) {
    fail(
      "version-pin",
      `the service publishes version ${served ?? "(none)"}, outside the pinned range ` +
        `${compatibility.PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE}.`,
    );
  }

  if (pins.serviceVersionRange !== compatibility.PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE) {
    fail(
      "version-pin",
      `package.json promptEngineM8.serviceVersionRange (${pins.serviceVersionRange}) disagrees with ` +
        `compatibility.ts (${compatibility.PROMPT_ENGINE_M8_SERVICE_VERSION_RANGE}).`,
    );
  }
  if (pins.contract !== compatibility.PROMPT_ENGINE_M8_CONTRACT) {
    fail(
      "version-pin",
      `package.json promptEngineM8.contract (${pins.contract}) disagrees with ` +
        `compatibility.ts (${compatibility.PROMPT_ENGINE_M8_CONTRACT}).`,
    );
  }
  if (pins.testedServiceVersion !== compatibility.PROMPT_ENGINE_M8_TESTED_SERVICE_VERSION) {
    fail(
      "version-pin",
      `package.json promptEngineM8.testedServiceVersion (${pins.testedServiceVersion}) disagrees with ` +
        `compatibility.ts (${compatibility.PROMPT_ENGINE_M8_TESTED_SERVICE_VERSION}).`,
    );
  }
  if (served && pins.testedServiceVersion !== served) {
    note(
      "version-pin",
      `the document publishes ${served}; this client records ${pins.testedServiceVersion} as the tested ` +
        "service version. Inside the pinned range, so not a break — retest and move the pin when convenient.",
    );
  }
}

function checkCallSites(pathIndex, calls) {
  const used = new Set();
  for (const call of calls) {
    const operation = operationFor(pathIndex, call.method, call.path);
    if (!operation) {
      fail(
        "routes",
        `${call.method} ${call.path} (src/runtime/api/${call.file}) is not an operation the service publishes.`,
      );
      continue;
    }
    used.add(`${call.method} ${pathShape(call.path)}`);

    const declared = queryParameters(operation);
    for (const name of call.query) {
      if (!(name in declared)) {
        fail(
          "routes",
          `${call.method} ${call.path} sends the query parameter \`${name}\`, which the service does not declare.`,
        );
      }
    }
  }

  for (const [shape, entry] of pathIndex.index) {
    for (const method of Object.keys(entry.operations)) {
      if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
      if (!used.has(`${method.toUpperCase()} ${shape}`)) {
        note("routes", `${method.toUpperCase()} ${entry.path} is published and this client calls nothing on it.`);
      }
    }
  }
}

function checkListVocabulary(document, pathIndex, schemas, listParams) {
  for (const endpoint of LIST_ENDPOINTS) {
    const operation = operationFor(pathIndex, "GET", endpoint.path);
    if (!operation) {
      fail("list-contract", `GET ${endpoint.path} is not published — the list contract has no server.`);
      continue;
    }
    const schema = schemas[endpoint.schema];
    const declared = queryParameters(operation);

    // 1. Every parameter the service declares is one this client can send.
    for (const [name, parameter] of Object.entries(declared)) {
      const value = parameterSample(document, parameter);
      if (!schema.safeParse({ [name]: value }).success) {
        fail(
          "list-contract",
          `GET ${endpoint.path} declares \`${name}\`, and ${endpoint.schema} rejects it — a control the ` +
            "service answers that this client cannot ask for.",
        );
      }
    }

    // 2. Every parameter this client accepts is one the service declares, and
    //    one that survives translation onto the wire. A typed surface the api
    //    wrapper drops on the floor is `H1`.
    for (const name of KNOWN_LIST_PARAMS) {
      const value = name === "page" || name === "pageSize" || name === "skip" || name === "limit" ? 1 : "";
      const probe = schema.safeParse({ [name]: value });
      if (!probe.success) continue;

      if (FORBIDDEN_LIST_PARAMS.has(name)) {
        fail(
          "list-contract",
          `${endpoint.schema} accepts \`${name}\`, which the service declares nowhere (\`H6\`). ` +
            "A parameter no route answers must not be on the typed surface.",
        );
        continue;
      }
      if (LOCAL_ONLY_LIST_PARAMS.has(name)) continue;
      if (!(name in declared)) {
        fail(
          "list-contract",
          `${endpoint.schema} accepts \`${name}\`, which GET ${endpoint.path} does not declare.`,
        );
        continue;
      }
      const parsed = schema.safeParse({ [name]: parameterSample(document, declared[name]) });
      if (!parsed.success) continue;
      const wire = listParams.toServiceListQuery(parsed.data);
      if (wire[name] === undefined) {
        fail(
          "list-contract",
          `${endpoint.schema} accepts \`${name}\` and toServiceListQuery drops it before the wire — ` +
            "the exact shape of `H1`: a typed list-param surface the api wrapper never sends.",
        );
      }
    }

    // 3. The mirrored vocabulary is the published vocabulary, value for value.
    for (const [parameterName, constantName] of Object.entries(endpoint.vocabulary)) {
      const mirrored = schemas[constantName];
      if (!Array.isArray(mirrored)) {
        fail("list-contract", `${constantName} is not exported by dist/src/runtime/schemas.js.`);
        continue;
      }
      const parameter = declared[parameterName];
      if (!parameter) {
        fail(
          "list-contract",
          `GET ${endpoint.path} no longer declares \`${parameterName}\`, but ${constantName} still mirrors ` +
            `${mirrored.length} values for it.`,
        );
        continue;
      }
      const published = parameterName === "f" ? publishedFacets(parameter) : publishedEnum(document, parameter);
      if (!published) {
        fail("list-contract", `GET ${endpoint.path} publishes no values for \`${parameterName}\`.`);
        continue;
      }
      compareVocabulary(`GET ${endpoint.path} \`${parameterName}\``, constantName, published, mirrored);
    }

    // `order` is shared by every endpoint and mirrored once.
    if (declared.order) {
      compareVocabulary(
        `GET ${endpoint.path} \`order\``,
        "listSortOrders",
        publishedEnum(document, declared.order) ?? [],
        [...schemas.listSortOrders],
      );
    }

    // 4. Bounds. Not a break when they disagree — an unmirrored ceiling costs a
    //    422 the user sees, not a silently wrong page — so these are notices.
    if (declared.q?.schema?.maxLength !== undefined && declared.q.schema.maxLength !== schemas.MAX_LIST_SEARCH_LENGTH) {
      note(
        "list-contract",
        `GET ${endpoint.path} bounds \`q\` at ${declared.q.schema.maxLength}; MAX_LIST_SEARCH_LENGTH is ` +
          `${schemas.MAX_LIST_SEARCH_LENGTH}.`,
      );
    }
    const maximum = declared.limit?.schema?.maximum;
    if (maximum !== undefined && schema.safeParse({ limit: maximum + 1 }).success) {
      note(
        "list-contract",
        `GET ${endpoint.path} bounds \`limit\` at ${maximum} and ${endpoint.schema} accepts ` +
          `${maximum + 1}; the service answers that request with a 422.`,
      );
    }
  }
}

function compareVocabulary(where, constantName, published, mirrored) {
  const missing = published.filter((value) => !mirrored.includes(value));
  const invented = mirrored.filter((value) => !published.includes(value));
  if (missing.length > 0) {
    fail("vocabulary", `${where} publishes ${JSON.stringify(missing)}, absent from ${constantName}.`);
  }
  if (invented.length > 0) {
    fail(
      "vocabulary",
      `${constantName} carries ${JSON.stringify(invented)}, which ${where} does not publish — the service ` +
        "answers those with a 422.",
    );
  }
  if (missing.length === 0 && invented.length === 0 && published.join(" ") !== mirrored.join(" ")) {
    note("vocabulary", `${constantName} lists the same values as ${where} in a different order.`);
  }
}

function checkRequestBodies(document, pathIndex, schemas) {
  for (const entry of REQUEST_BODIES) {
    const operation = operationFor(pathIndex, entry.method, entry.path);
    if (!operation) continue; // already reported by the route check
    const bodySchema = requestBodySchema(operation);
    if (!bodySchema) {
      fail("request-body", `${entry.method} ${entry.path} publishes no JSON request body.`);
      continue;
    }
    const resolved = deref(document, bodySchema);
    const schema = schemas[entry.schema];
    const required = resolved.required ?? [];
    const narrowed = entry.narrowed ?? {};

    const minimal = sample(document, bodySchema, "required");

    // Sufficient: exactly the published required set is a payload this client sends.
    const sufficient = schema.safeParse(minimal);
    if (!sufficient.success) {
      fail(
        "request-body",
        `${entry.schema} rejects the published required payload for ${entry.method} ${entry.path} ` +
          `(${JSON.stringify(required)}): ${formatIssues(sufficient.error)}`,
      );
    }

    // Necessary: dropping any published-required field must fail locally, or the
    // client validates a payload the service answers with a 422 (`H2`).
    for (const name of required) {
      const partial = { ...minimal };
      delete partial[name];
      if (schema.safeParse(partial).success) {
        fail(
          "request-body",
          `${entry.schema} accepts a payload without \`${name}\`, which ${entry.method} ${entry.path} ` +
            "requires — the shape of `H2`: it validates locally and fails on the wire.",
        );
      }
    }

    // Narrowing: a published property this client refuses needs a recorded reason.
    for (const name of Object.keys(resolved.properties ?? {})) {
      if (required.includes(name)) continue;
      const probe = { ...minimal, [name]: sample(document, resolved.properties[name], "all") };
      const accepted = schema.safeParse(probe).success;
      if (!accepted && !(name in narrowed)) {
        fail(
          "request-body",
          `${entry.schema} refuses the published optional property \`${name}\` on ${entry.method} ` +
            `${entry.path}, and REQUEST_BODIES records no reason for narrowing it.`,
        );
      }
      if (accepted && name in narrowed) {
        note(
          "request-body",
          `${entry.schema} now accepts \`${name}\`, recorded as narrowed in REQUEST_BODIES — drop the entry.`,
        );
      }
    }
  }
}

function checkModels(document, schemas) {
  const components = Object.keys(document.components?.schemas ?? {});
  for (const name of components) {
    const mapped = MODELS[name];
    if (!mapped) {
      if (!(name in UNMODELLED)) {
        fail(
          "models",
          `the service publishes the component \`${name}\`, which this client neither models (MODELS) nor ` +
            "records as deliberately unmodelled (UNMODELLED).",
        );
      }
      continue;
    }
    const schema = schemas[mapped];
    if (!schema) {
      fail("models", `${mapped} is not exported by dist/src/runtime/schemas.js.`);
      continue;
    }
    const component = document.components.schemas[name];

    // Receivable: a maximal instance of the published model must parse. A strict
    // client schema that has not caught up with an added field throws here
    // rather than in a consumer's browser.
    //
    // Two rejections are not the same thing, and the split is the whole value of
    // this check. *Structural* disagreement — a published key the client refuses,
    // or a key the client demands that the document does not publish — is drift:
    // it breaks on the next response. *Value-domain* disagreement is a mirroring
    // decision, and usually a deliberate narrowing: `TemplateBlockDict.type` is
    // published as a bare `string` because the service's TypedDict flattens the
    // enum, while this client keeps the six declared members. Narrower is safe to
    // receive; it is reported, not failed.
    const maximal = sample(document, component, "all");
    const parsed = schema.safeParse(maximal);
    if (!parsed.success) {
      const { structural, narrowing } = classifyIssues(parsed.error, maximal);
      if (structural.length > 0) {
        fail("models", `${mapped} disagrees structurally with published \`${name}\`: ${structural.join("; ")}`);
        continue;
      }
      note("models", `${mapped} is narrower than published \`${name}\`: ${narrowing.join("; ")}`);
    }

    // Minimal instances are a notice, not a break: a response model with a
    // default always serialises the field, so a client may require more than
    // the document marks required without ever being wrong.
    const minimal = sample(document, component, "required");
    if (!schema.safeParse(minimal).success) {
      note(
        "models",
        `${mapped} requires more than published \`${name}\` marks required. Harmless for a response ` +
          "(defaults always serialise); a break if this model is ever sent.",
      );
    }
  }

  for (const name of Object.keys(MODELS)) {
    if (!components.includes(name)) {
      fail("models", `MODELS maps \`${name}\`, which the service no longer publishes.`);
    }
  }
  for (const name of Object.keys(UNMODELLED)) {
    if (!components.includes(name)) {
      note("models", `UNMODELLED records \`${name}\`, which the service no longer publishes — drop the entry.`);
    }
  }
}

function formatIssues(error) {
  return error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/** Does `path` address a value that exists in the sampled instance? */
function pathExists(instance, path) {
  let current = instance;
  for (const key of path) {
    if (current === null || typeof current !== "object" || !(key in current)) return false;
    current = current[key];
  }
  return true;
}

/**
 * Split parse issues into structural drift and value-domain narrowing.
 *
 * An `unrecognized_keys` issue means the document publishes a property this
 * client refuses; an issue whose path addresses nothing in the sampled instance
 * means this client demands a property the document does not publish. Both
 * break on a real response. Everything else is the client being stricter about
 * a value it can already hold.
 */
function classifyIssues(error, instance) {
  const structural = [];
  const narrowing = [];
  for (const issue of error.issues) {
    const where = issue.path.join(".") || "(root)";
    if (issue.code === "unrecognized_keys") {
      structural.push(`published ${JSON.stringify(issue.keys ?? [])} refused at ${where}`);
    } else if (!pathExists(instance, issue.path)) {
      structural.push(`${where} is required here and not published`);
    } else {
      narrowing.push(`${where}: ${issue.message}`);
    }
  }
  return { structural, narrowing: narrowing.slice(0, 4) };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const source = args.openapi ?? VENDORED;
const { text, origin } = await loadDocument(source);
const document = JSON.parse(text);

if (args.write) {
  writeFileSync(VENDORED, text.endsWith("\n") ? text : `${text}\n`, "utf-8");
  console.log(`[verify-contract-drift] refreshed contracts/prompt-engine-m8.openapi.json from ${origin}`);
}

const { schemas, listParams, compatibility } = await loadRuntime();
const pathIndex = buildPathIndex(document);

checkVersionPin(document, packageJson, compatibility);
checkCallSites(pathIndex, callSites());
checkListVocabulary(document, pathIndex, schemas, listParams);
checkRequestBodies(document, pathIndex, schemas);
checkModels(document, schemas);

console.log(`[verify-contract-drift] ${origin}`);
console.log(
  `[verify-contract-drift] ${document.info?.title} ${document.info?.version} ` +
    `(prefix ${pathIndex.apiPrefix || "(none)"}, ${pathIndex.index.size} paths)`,
);

for (const { check, message } of notices) {
  console.log(`  note  [${check}] ${message}`);
}

if (failures.length > 0) {
  console.error(`[verify-contract-drift] ${failures.length} contract drift(s):`);
  for (const { check, message } of failures) {
    console.error(`  FAIL  [${check}] ${message}`);
  }
  console.error(
    "[verify-contract-drift] the published contract and this client disagree. Read each line as a contract " +
      "change: fix the client, or refresh the vendored document if it is stale (`--openapi <url> --write`).",
  );
  process.exit(1);
}

console.log(
  `[verify-contract-drift] no drift — ${Object.keys(MODELS).length} models, ${LIST_ENDPOINTS.length} list ` +
    `contracts and ${REQUEST_BODIES.length} request bodies agree with the published document.`,
);
