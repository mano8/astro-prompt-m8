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
