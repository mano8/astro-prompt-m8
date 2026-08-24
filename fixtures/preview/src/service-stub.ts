// An in-memory stand-in for `prompt-engine-m8`, for the dev-only gallery.
//
// The gallery mounts the plugin's *real* views, so it needs a real transport:
// the views call hooks, the hooks call the api wrappers, and those wrappers
// `fetch` and then `schema.parse()` the response. Stubbing `fetch` is therefore
// the only seam that leaves every layer above it genuine — mock the hooks
// instead and the gallery stops showing the plugin and starts showing the mock.
//
// It honours the declared list vocabulary (`q`, `csrc`, `sort`, `order`, `f`,
// `skip`, `limit`) rather than returning a fixed page, because the whole point
// of the shipped table is that those parameters reach a service that answers
// them. A stub that ignored them would render a server-driven table that
// behaves like a client-side one — the exact defect (`H1`/`H6`) this plan
// existed to remove.
import type {
  CategoriesPublic,
  CategoryPublic,
  PromptBlockPublic,
  PromptBlocksPublic,
  PromptTemplatePublic,
  PromptTemplatesPublic
} from "../../../src/runtime/schemas.js";

const BLOCK_TYPES = ["role", "task", "context", "instruction", "example", "format"] as const;
const OWNER = "3f1a6c22-6c3c-4f0a-9c1a-2b7d5e8f0a11";

function makeBlocks(total: number): PromptBlockPublic[] {
  return Array.from({ length: total }, (_, index) => {
    const id = index + 1;
    const type = BLOCK_TYPES[index % BLOCK_TYPES.length];
    return {
      id,
      name: `${type} block ${id}`,
      slug: `${type}-block-${id}`,
      description: index % 3 === 0 ? null : `Sample ${type} block for the gallery.`,
      content:
        index % 4 === 0
          ? `You are a helpful ${type}. Use {{dynamic_content}} where the caller fills in.`
          : `Static ${type} guidance number ${id}.`,
      type,
      is_dynamic: index % 4 === 0,
      is_public: index % 2 === 0,
      owner_id: OWNER
    };
  });
}

function makeTemplates(blocks: PromptBlockPublic[], total: number): PromptTemplatePublic[] {
  return Array.from({ length: total }, (_, index) => {
    const id = index + 1;
    const members = blocks.slice(index % 5, (index % 5) + 3);
    return {
      id,
      name: `Template ${id}`,
      slug: `template-${id}`,
      description: index % 2 === 0 ? `Gallery template ${id}.` : null,
      is_public: index % 3 !== 0,
      // `TemplateBlockPublicSchema` is strict and carries no `owner_id`, so the
      // block is rebuilt field by field rather than spread: spreading leaks
      // `owner_id` and the response is rejected before it reaches the view.
      blocks: members.map((block, position) => ({
        id: block.id,
        block_id: block.id,
        template_id: id,
        name: block.name,
        slug: block.slug,
        description: block.description,
        content: block.content,
        type: block.type,
        is_dynamic: block.is_dynamic,
        is_public: block.is_public,
        position
      }))
    };
  });
}

const CATEGORIES: CategoryPublic[] = [
  { id: 1, name: "Drafting", slug: "drafting", type: "prompt_block", owner_id: OWNER },
  { id: 2, name: "Review", slug: "review", type: "prompt_block", owner_id: OWNER },
  { id: 3, name: "Release notes", slug: "release-notes", type: "prompt_template", owner_id: OWNER }
];

const ALL_BLOCKS = makeBlocks(137);
const ALL_TEMPLATES = makeTemplates(ALL_BLOCKS, 42);

/** Columns `q` searches when `csrc` does not narrow it, per resource. */
const SEARCHABLE = {
  block: ["name", "slug", "description", "content"],
  template: ["name", "slug", "description"],
  category: ["name", "slug"]
} as const;

function readField(row: Record<string, unknown>, column: string): string {
  const value = row[column];
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function matchesSearch(
  row: Record<string, unknown>,
  q: string,
  csrc: string,
  columns: readonly string[]
): boolean {
  if (q === "") return true;
  const needle = q.toLowerCase();
  const searched = csrc === "" ? columns : [csrc];
  return searched.some((column) => readField(row, column).toLowerCase().includes(needle));
}

/** `f` is a comma-joined allow-list; here it filters on `type`. */
function matchesFilter(row: Record<string, unknown>, f: string): boolean {
  if (f === "") return true;
  const wanted = new Set(f.split(",").filter(Boolean));
  return wanted.has(readField(row, "type"));
}

function compare(a: Record<string, unknown>, b: Record<string, unknown>, sort: string): number {
  const left = a[sort];
  const right = b[sort];
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  return readField(a, sort).localeCompare(readField(b, sort));
}

function paginate<T extends Record<string, unknown>>(
  rows: T[],
  params: URLSearchParams,
  columns: readonly string[]
): { data: T[]; count: number } {
  // A blank parameter means *absent*, not "match the empty string": an unset
  // table control sends `q=`/`sort=`/`f=` rather than omitting the key. The
  // service treats it that way, so the stub has to as well.
  const q = (params.get("q") ?? "").trim();
  const csrc = (params.get("csrc") ?? "").trim();
  const f = (params.get("f") ?? "").trim();
  const sort = (params.get("sort") ?? "").trim();
  const order = (params.get("order") ?? "asc").trim();
  const skip = Number(params.get("skip") ?? "0");
  const limit = Number(params.get("limit") ?? "100");

  const filtered = rows.filter(
    (row) => matchesSearch(row, q, csrc, columns) && matchesFilter(row, f)
  );
  const sorted =
    sort === ""
      ? filtered
      : [...filtered].sort((a, b) => (order === "desc" ? -1 : 1) * compare(a, b, sort));

  return {
    // `count` is the *filtered* count. That behaviour change is the reason the
    // paginator can be trusted at all (`C2`), so the stub reproduces it.
    count: sorted.length,
    data: sorted.slice(skip, skip + limit)
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

let nextBlockId = ALL_BLOCKS.length + 1;
let nextTemplateId = ALL_TEMPLATES.length + 1;

/**
 * Replaces `globalThis.fetch` for the lifetime of the gallery page. Returns the
 * original so a caller can restore it; the gallery never does, because the page
 * exists only to talk to this stub.
 */
export function installServiceStub(): typeof globalThis.fetch {
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      window.location.origin
    );
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;
    const params = url.searchParams;

    // Latency, so the loading states in the gallery are reachable rather than
    // theoretical.
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (path.endsWith("/meta")) {
      return json({
        contract_name: "prompt-engine-m8",
        contract_version: "2.0.0",
        service_version: "2.0.0",
        service_name: "prompt-engine-m8"
      });
    }
    if (path.endsWith("/ping")) return json({ success: true, msg: "pong" });

    if (path.endsWith("/prompt-block/add/") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as Partial<PromptBlockPublic>;
      const created: PromptBlockPublic = {
        id: nextBlockId,
        name: body.name ?? `Block ${nextBlockId}`,
        slug: (body.name ?? `block-${nextBlockId}`).toLowerCase().replace(/\s+/g, "-"),
        description: body.description ?? null,
        content: body.content ?? "New block content.",
        type: body.type ?? "task",
        is_dynamic: body.is_dynamic ?? false,
        is_public: body.is_public ?? false,
        owner_id: OWNER
      };
      nextBlockId += 1;
      ALL_BLOCKS.unshift(created);
      return json(created, 201);
    }

    if (path.endsWith("/prompt-template/add/") && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as Partial<PromptTemplatePublic>;
      const created: PromptTemplatePublic = {
        id: nextTemplateId,
        name: body.name ?? `Template ${nextTemplateId}`,
        slug: (body.name ?? `template-${nextTemplateId}`).toLowerCase().replace(/\s+/g, "-"),
        description: body.description ?? null,
        is_public: body.is_public ?? false,
        blocks: []
      };
      nextTemplateId += 1;
      ALL_TEMPLATES.unshift(created);
      return json(created, 201);
    }

    if (path.includes("/prompt-block/") && method === "GET") {
      const page = paginate(
        ALL_BLOCKS as unknown as Record<string, unknown>[],
        params,
        SEARCHABLE.block
      );
      return json(page as unknown as PromptBlocksPublic);
    }

    if (path.includes("/prompt-template/") && method === "GET") {
      const page = paginate(
        ALL_TEMPLATES as unknown as Record<string, unknown>[],
        params,
        SEARCHABLE.template
      );
      return json(page as unknown as PromptTemplatesPublic);
    }

    if (path.includes("/category/") && method === "GET") {
      const page = paginate(
        CATEGORIES as unknown as Record<string, unknown>[],
        params,
        SEARCHABLE.category
      );
      return json(page as unknown as CategoriesPublic);
    }

    if (path.includes("/dashboard/")) {
      return json({
        data: [
          { label: "blocks", count: ALL_BLOCKS.length },
          { label: "templates", count: ALL_TEMPLATES.length }
        ],
        count: 2
      });
    }

    // Anything unrecognised answers 404 rather than hanging, so a gap in the
    // stub shows up as the plugin's own error surface instead of a spinner.
    return json({ detail: `No gallery stub for ${method} ${path}` }, 404);
  }) as typeof globalThis.fetch;

  return original;
}
