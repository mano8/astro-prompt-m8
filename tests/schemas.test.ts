import { describe, expect, it } from "vitest";
import * as s from "../src/runtime/schemas.js";

function block() {
  return {
    id: 1,
    name: "n",
    slug: "n",
    description: null,
    content: "c",
    type: "role",
    is_dynamic: false,
    is_public: false,
    owner_id: "u1"
  };
}

function template() {
  return {
    id: 1,
    name: "n",
    slug: "n",
    description: null,
    is_public: false,
    blocks: []
  };
}

function templateBlock() {
  return {
    id: 1,
    block_id: 1,
    template_id: 1,
    name: "n",
    slug: "n",
    description: null,
    content: "c",
    type: "role",
    is_dynamic: false,
    is_public: false,
    position: 1
  };
}

function category() {
  return {
    id: 1,
    name: "x",
    slug: "x",
    type: "prompt_block",
    owner_id: "u1"
  };
}

describe("enum schemas", () => {
  it("accepts known values and rejects unknown", () => {
    expect(s.PromptBlockTypeSchema.parse("role")).toBe("role");
    expect(s.PromptBlockTypeSchema.parse("format")).toBe("format");
    expect(() => s.PromptBlockTypeSchema.parse("nope")).toThrow();
    expect(s.CategoryTypeSchema.parse("prompt_block")).toBe("prompt_block");
    expect(() => s.CategoryTypeSchema.parse("other")).toThrow();
  });
});

describe("block schemas", () => {
  it("parses a public block and list", () => {
    expect(s.PromptBlockPublicSchema.parse(block()).id).toBe(1);
    expect(s.PromptBlocksPublicSchema.parse({ data: [block()], count: 1 }).count).toBe(1);
  });

  it("create/update accept optional dynamic/public/slug", () => {
    expect(
      s.PromptBlockCreateSchema.parse({
        name: "n",
        content: "c",
        type: "role"
      }).is_dynamic
    ).toBeUndefined();
  });

  it("rejects extra fields on public block", () => {
    expect(() => s.PromptBlockPublicSchema.parse({ ...block(), extra: 1 })).toThrow();
  });
});

describe("template schemas", () => {
  it("parses a public template with blocks", () => {
    const tpl = { ...template(), blocks: [templateBlock()] };
    expect(s.PromptTemplatePublicSchema.parse(tpl).blocks.length).toBe(1);
    expect(
      s.PromptTemplatesPublicSchema.parse({ data: [tpl], count: 1 }).data.length
    ).toBe(1);
  });

  it("create accepts optional description/is_public", () => {
    const out = s.PromptTemplateCreateSchema.parse({ name: "n", description: null });
    expect(out.name).toBe("n");
  });

  it("template block is parsed with strict shape", () => {
    expect(s.TemplateBlockPublicSchema.parse(templateBlock()).position).toBe(1);
  });

  it("rejects extra fields on template block", () => {
    expect(() => s.TemplateBlockPublicSchema.parse({ ...templateBlock(), extra: 1 })).toThrow();
  });
});

describe("compose schemas", () => {
  it("exposes the dynamic content placeholder contract", () => {
    expect(s.DYNAMIC_CONTENT_PLACEHOLDER).toBe("{{dynamic_content}}");
    expect(s.hasDynamicContentPlaceholder("Before {{dynamic_content}} after")).toBe(true);
    expect(s.hasDynamicContentPlaceholder("Before dynamic content after")).toBe(false);
  });

  it("inserts the dynamic content placeholder without changing other text", () => {
    expect(s.insertDynamicContentPlaceholder("")).toBe("{{dynamic_content}}");
    expect(s.insertDynamicContentPlaceholder("Before ")).toBe("Before {{dynamic_content}}");
    expect(s.insertDynamicContentPlaceholder("Before after", 7, 7)).toBe(
      "Before {{dynamic_content}}after"
    );
    expect(s.insertDynamicContentPlaceholder("Before replace after", 7, 14)).toBe(
      "Before {{dynamic_content}} after"
    );
    expect(s.insertDynamicContentPlaceholder("content", -5, 50)).toBe("{{dynamic_content}}");
  });

  it("validates dynamic blocks and composed output", () => {
    expect(s.DynamicBlockSchema.parse({ id: 1, content: "c" }).id).toBe(1);
    expect(() => s.DynamicBlockSchema.parse({ id: 0, content: "c" })).toThrow();
    expect(() => s.DynamicBlockSchema.parse({ id: 1, content: "" })).toThrow();
    expect(s.ComposedPromptSchema.parse({ content: "x" }).content).toBe("x");
  });
});

describe("category & response schemas", () => {
  it("parses category public, create and list", () => {
    expect(s.CategoryPublicSchema.parse(category()).slug).toBe("x");
    expect(() => s.CategoryCreateSchema.parse({ name: "" })).toThrow();
    expect(s.CategoriesPublicSchema.parse({ data: [category()], count: 1 }).count).toBe(1);
  });

  it("requires `type` on a category create, as the service does (H2)", () => {
    expect(s.CategoryCreateSchema.parse({ name: "x", type: "prompt_block" })).toEqual({
      name: "x",
      type: "prompt_block"
    });
    expect(s.CategoryCreateSchema.parse({ name: "x", type: "prompt_template" }).type).toBe(
      "prompt_template"
    );
    // The gap `H2` names: this parsed locally and 422'd on the wire.
    expect(() => s.CategoryCreateSchema.parse({ name: "x" })).toThrow();
    expect(() => s.CategoryCreateSchema.parse({ name: "x", type: "other" })).toThrow();
    // The service derives `slug` from `name` and overwrites whatever arrives,
    // so offering the field would publish a knob that does nothing.
    expect(() =>
      s.CategoryCreateSchema.parse({ name: "x", type: "prompt_block", slug: "x" })
    ).toThrow();
    // Update reuses the create shape, exactly as `CategoryUpdate` does.
    expect(() => s.CategoryUpdateSchema.parse({ name: "x" })).toThrow();
  });

  it("reads the shared /meta payload leniently but pins what it uses", () => {
    const meta = {
      service: "prompt-engine-m8",
      version: "2.0.0",
      api_version: "v1",
      contract: { name: "prompt-engine-m8", version: "2.0.0", range: ">=2.0.0 <3.0.0" }
    };
    expect(s.ServiceMetaSchema.parse(meta)).toMatchObject(meta);
    // A field added to the shared schema must not break the preflight.
    expect(s.ServiceMetaSchema.parse({ ...meta, build: "abc" })).toMatchObject({ build: "abc" });
    expect(
      s.ServiceContractSchema.parse({ ...meta.contract, deprecated: [] }).name
    ).toBe("prompt-engine-m8");
    // What the preflight reads is still required.
    expect(() => s.ServiceMetaSchema.parse({ ...meta, version: "" })).toThrow();
    expect(() => s.ServiceMetaSchema.parse({ ...meta, contract: {} })).toThrow();
    expect(() => s.ServiceMetaSchema.parse({ service: meta.service })).toThrow();
  });

  it("response model/message envelopes", () => {
    expect(s.ResponseMessageSchema.parse({ success: true, msg: "ok" }).success).toBe(true);
    expect(() => s.ResponseMessageSchema.parse({ success: "x" })).toThrow();
    expect(s.ResponseModelBaseSchema.parse({ success: true, data: "x" }).data).toBe("x");
    expect(
      s.ResponseModelOrMessageSchema.parse({ success: false, msg: "missing" }).success
    ).toBe(false);
  });
});

describe("portable import/export", () => {
  it("strips server identity from a block", () => {
    const portable = s.toPortableBlock(block());
    expect(portable).toEqual({
      name: "n",
      slug: "n",
      description: null,
      content: "c",
      type: "role",
      is_dynamic: false,
      is_public: false
    });
    expect(portable).not.toHaveProperty("id");
    expect(portable).not.toHaveProperty("owner_id");
  });

  it("defaults a missing block slug to null", () => {
    const { slug, ...noSlug } = block();
    expect(slug).toBeDefined();
    expect(s.toPortableBlock(noSlug as ReturnType<typeof block>).slug).toBeNull();
  });

  it("orders template blocks by position and strips identity", () => {
    const tpl = {
      ...template(),
      blocks: [
        { ...templateBlock(), id: 2, block_id: 2, position: 2, name: "second" },
        { ...templateBlock(), id: 1, block_id: 1, position: 1, name: "first" }
      ]
    };
    const portable = s.toPortableTemplate(s.PromptTemplatePublicSchema.parse(tpl));
    expect(portable.blocks.map((b) => b.block.name)).toEqual(["first", "second"]);
    expect(portable.blocks[0].block).not.toHaveProperty("template_id");
    expect(portable).not.toHaveProperty("id");
  });

  it("builds, serializes and re-parses an export round-trip", () => {
    const built = s.buildPromptExport(
      { blocks: [s.toPortableBlock(block())] },
      "2026-07-12T00:00:00.000Z"
    );
    expect(built.format).toBe(s.PROMPT_EXPORT_FORMAT);
    expect(built.version).toBe(s.PROMPT_EXPORT_VERSION);
    expect(built.templates).toEqual([]);
    const json = s.serializePromptExport(built);
    expect(s.parsePromptExport(JSON.parse(json))).toEqual(built);
  });

  it("stamps exportedAt automatically and defaults empty parts", () => {
    const built = s.buildPromptExport({});
    expect(typeof built.exportedAt).toBe("string");
    expect(built.blocks).toEqual([]);
    expect(built.templates).toEqual([]);
  });

  it("rejects a malformed or wrong-format payload", () => {
    expect(() => s.parsePromptExport({ format: "other", version: 1, exportedAt: "x" })).toThrow();
    expect(() => s.parsePromptExport({})).toThrow();
  });

  it("defaults blocks/templates arrays when omitted", () => {
    const parsed = s.parsePromptExport({
      format: s.PROMPT_EXPORT_FORMAT,
      version: s.PROMPT_EXPORT_VERSION,
      exportedAt: "x"
    });
    expect(parsed.blocks).toEqual([]);
    expect(parsed.templates).toEqual([]);
  });

  it("builds a collision-safe filename", () => {
    expect(s.promptExportFilename("block", "My Slug!")).toBe("prompt-block-my-slug.json");
    expect(s.promptExportFilename("template", null)).toBe("prompt-template.json");
    expect(s.promptExportFilename("bundle", "--x--")).toBe("prompt-bundle-x.json");
  });
});

describe("dashboard schemas", () => {
  it("parses users activity and counters", () => {
    const payload = {
      nb_users: 4,
      activity: {
        min: 0,
        max: 10,
        activity: [{ model: "PromptBlock", updated: 1, added: 2 }]
      }
    };
    expect(s.UsersActivitySchema.parse(payload).nb_users).toBe(4);
    expect(s.ActivityCounterSchema.parse({ model: "X", updated: 1, added: 2 }).added).toBe(2);
    expect(() => s.ActivityStatsSchema.parse({ min: 0, max: 0, activity: [] })).not.toThrow();
  });
});

describe("declared list vocabulary", () => {
  it("declares every block facet the block library can select", () => {
    // The six type facets mirror PromptBlockType one-for-one; the four
    // remaining ones are the two boolean axes the table filters on.
    expect(s.promptBlockFacets).toEqual([
      ...s.PromptBlockTypeSchema.options,
      "dynamic",
      "static",
      "public",
      "private"
    ]);
    expect(s.promptTemplateFacets).toEqual(["public", "private"]);
  });

  it("declares the column names the service orders by, not the UI's labels", () => {
    // `is_dynamic`/`is_public` are the service's column names. A table header
    // labelled "Dynamic" must still emit `is_dynamic`.
    expect(s.promptBlockSortFields).toContain("is_dynamic");
    expect(s.promptBlockSortFields).toContain("is_public");
    expect(s.promptBlockSortFields).not.toContain("dynamic");
    expect(s.promptBlockSortFields).not.toContain("visibility");
    expect(s.promptTemplateSortFields).toContain("block_count");
    expect(s.promptTemplateSortFields).not.toContain("visibility");
  });

  it("keeps csrc within the columns q scans", () => {
    for (const field of s.promptBlockSearchFields) {
      expect(s.promptBlockSortFields.includes(field as never)).toBe(
        ["name", "slug"].includes(field)
      );
    }
    expect(s.promptTemplateSearchFields.every((field) => typeof field === "string")).toBe(true);
    // `/category/` publishes search columns but no `csrc`; the emptiness is the
    // contract, so the params schema must not accept one.
    expect(s.categorySearchFields).toEqual(["name", "slug"]);
  });
});

describe("list-params request schemas", () => {
  it("accepts every declared value on the block endpoint", () => {
    for (const csrc of s.promptBlockSearchFields) {
      expect(s.PromptBlockListParamsSchema.parse({ csrc }).csrc).toBe(csrc);
    }
    for (const sort of s.promptBlockSortFields) {
      expect(s.PromptBlockListParamsSchema.parse({ sort }).sort).toBe(sort);
    }
    for (const facet of s.promptBlockFacets) {
      expect(s.PromptBlockListParamsSchema.parse({ f: facet }).f).toBe(facet);
    }
    for (const order of s.listSortOrders) {
      expect(s.PromptBlockListParamsSchema.parse({ order }).order).toBe(order);
    }
  });

  it("accepts every declared value on the template and category endpoints", () => {
    for (const csrc of s.promptTemplateSearchFields) {
      expect(s.PromptTemplateListParamsSchema.parse({ csrc }).csrc).toBe(csrc);
    }
    for (const sort of s.promptTemplateSortFields) {
      expect(s.PromptTemplateListParamsSchema.parse({ sort }).sort).toBe(sort);
    }
    for (const facet of s.promptTemplateFacets) {
      expect(s.PromptTemplateListParamsSchema.parse({ f: facet }).f).toBe(facet);
    }
    for (const sort of s.categorySortFields) {
      expect(s.CategoryListParamsSchema.parse({ sort }).sort).toBe(sort);
    }
  });

  it("reads a blank enum as the unset control it is", () => {
    expect(s.PromptBlockListParamsSchema.parse({ sort: "", csrc: "", order: "", f: "" })).toEqual({
      sort: "",
      csrc: "",
      order: "",
      f: ""
    });
    expect(s.CategoryListParamsSchema.parse({ sort: "", order: "" }).sort).toBe("");
  });

  it("rejects an undeclared value rather than letting the service 422", () => {
    expect(() => s.PromptBlockListParamsSchema.parse({ sort: "dynamic" })).toThrow();
    expect(() => s.PromptBlockListParamsSchema.parse({ csrc: "type" })).toThrow();
    expect(() => s.PromptBlockListParamsSchema.parse({ order: "ASC" })).toThrow();
    expect(() => s.PromptTemplateListParamsSchema.parse({ sort: "content" })).toThrow();
    expect(() => s.PromptTemplateListParamsSchema.parse({ f: "dynamic" })).toThrow();
    expect(() => s.CategoryListParamsSchema.parse({ sort: "content" })).toThrow();
  });

  it("rejects a parameter the endpoint does not declare", () => {
    // `/category/` offers no `csrc` and no `f`. Sending either would be a
    // control the service never answers.
    expect(() => s.CategoryListParamsSchema.parse({ csrc: "name" })).toThrow();
    expect(() => s.CategoryListParamsSchema.parse({ f: "public" })).toThrow();
    // `vsrc` is URL state, not a service parameter.
    expect(() => s.PromptBlockListParamsSchema.parse({ vsrc: "hero" })).toThrow();
  });

  it("accepts a comma-joined facet list and rejects one with an undeclared part", () => {
    expect(s.PromptBlockListParamsSchema.parse({ f: "role,dynamic,public" }).f).toBe(
      "role,dynamic,public"
    );
    expect(() => s.PromptBlockListParamsSchema.parse({ f: "role,unknown" })).toThrow();
    expect(() =>
      s.PromptBlockListParamsSchema.parse({ f: "role,".repeat(s.MAX_LIST_SEARCH_LENGTH) })
    ).toThrow();
  });

  it("bounds q the way the service bounds it", () => {
    expect(
      s.PromptBlockListParamsSchema.parse({ q: "x".repeat(s.MAX_LIST_SEARCH_LENGTH) }).q
    ).toHaveLength(s.MAX_LIST_SEARCH_LENGTH);
    expect(() =>
      s.PromptBlockListParamsSchema.parse({ q: "x".repeat(s.MAX_LIST_SEARCH_LENGTH + 1) })
    ).toThrow();
  });

  it("rejects an offset that cannot address a page", () => {
    expect(() => s.PromptBlockListParamsSchema.parse({ skip: -1 })).toThrow();
    expect(() => s.PromptBlockListParamsSchema.parse({ limit: 0 })).toThrow();
    expect(() => s.PromptBlockListParamsSchema.parse({ page: 0 })).toThrow();
    expect(() => s.PromptBlockListParamsSchema.parse({ pageSize: 0 })).toThrow();
  });
});
