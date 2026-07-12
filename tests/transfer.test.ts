import { beforeEach, describe, expect, it, vi } from "vitest";

const getBlock = vi.hoisted(() => vi.fn());
const createBlock = vi.hoisted(() => vi.fn());
const getBlockBySlug = vi.hoisted(() => vi.fn());
const getTemplate = vi.hoisted(() => vi.fn());
const createTemplate = vi.hoisted(() => vi.fn());
const getTemplateBySlug = vi.hoisted(() => vi.fn());
const addTemplateBlock = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/api/blocks.js", () => ({ getBlock, createBlock, getBlockBySlug }));
vi.mock("../src/runtime/api/templates.js", () => ({
  getTemplate,
  createTemplate,
  getTemplateBySlug,
  addTemplateBlock
}));

import {
  exportBlockById,
  exportTemplateById,
  importPromptExport
} from "../src/runtime/api/transfer.js";
import { PROMPT_EXPORT_FORMAT, PROMPT_EXPORT_VERSION } from "../src/runtime/schemas.js";

function publicBlock(over: Record<string, unknown> = {}) {
  return {
    id: 5,
    name: "n",
    slug: "n",
    description: null,
    content: "c",
    type: "role",
    is_dynamic: false,
    is_public: false,
    owner_id: "u1",
    ...over
  };
}

function publicTemplate(over: Record<string, unknown> = {}) {
  return { id: 9, name: "t", slug: "t", description: null, is_public: false, blocks: [], ...over };
}

function templateBlock(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    block_id: 1,
    template_id: 9,
    name: "b",
    slug: "b",
    description: null,
    content: "c",
    type: "role",
    is_dynamic: false,
    is_public: false,
    position: 1,
    ...over
  };
}

function envelope(over: Record<string, unknown> = {}) {
  return {
    format: PROMPT_EXPORT_FORMAT,
    version: PROMPT_EXPORT_VERSION,
    exportedAt: "2026-07-12T00:00:00.000Z",
    blocks: [],
    templates: [],
    ...over
  };
}

const portableBlock = { name: "n", slug: "n", content: "c", type: "role" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("export", () => {
  it("exports a single block without server identity", async () => {
    getBlock.mockResolvedValueOnce(publicBlock());
    const out = await exportBlockById(5);
    expect(getBlock).toHaveBeenCalledWith(5);
    expect(out.format).toBe(PROMPT_EXPORT_FORMAT);
    expect(out.blocks[0]).not.toHaveProperty("owner_id");
    expect(out.blocks[0].slug).toBe("n");
    expect(out.templates).toEqual([]);
  });

  it("exports a template with embedded blocks", async () => {
    getTemplate.mockResolvedValueOnce(publicTemplate({ blocks: [templateBlock()] }));
    const out = await exportTemplateById(9);
    expect(getTemplate).toHaveBeenCalledWith(9);
    expect(out.templates[0].blocks[0].block.slug).toBe("b");
    expect(out.templates[0].blocks[0].block).not.toHaveProperty("template_id");
  });
});

describe("import blocks", () => {
  it("creates a block when its slug is absent from the account", async () => {
    getBlockBySlug.mockResolvedValueOnce(null);
    createBlock.mockResolvedValueOnce(publicBlock({ id: 10 }));
    const res = await importPromptExport(envelope({ blocks: [portableBlock] }));
    expect(createBlock).toHaveBeenCalledOnce();
    expect(res.blocks.created).toEqual([{ slug: "n", name: "n" }]);
    expect(res.blocks.reused).toEqual([]);
  });

  it("reuses an existing block instead of duplicating it", async () => {
    getBlockBySlug.mockResolvedValueOnce(publicBlock({ id: 7 }));
    const res = await importPromptExport(envelope({ blocks: [portableBlock] }));
    expect(createBlock).not.toHaveBeenCalled();
    expect(res.blocks.reused).toEqual([{ slug: "n", name: "n" }]);
  });

  it("creates directly (no dedup) when a block carries no slug", async () => {
    createBlock.mockResolvedValueOnce(publicBlock({ id: 11 }));
    const res = await importPromptExport(
      envelope({ blocks: [{ name: "x", content: "c", type: "role" }] })
    );
    expect(getBlockBySlug).not.toHaveBeenCalled();
    expect(res.blocks.created).toEqual([{ slug: null, name: "x" }]);
  });
});

describe("import templates", () => {
  const templatePayload = envelope({
    templates: [
      {
        name: "t",
        slug: "t",
        description: null,
        is_public: false,
        blocks: [{ position: 0, block: { name: "b", slug: "b", content: "c", type: "role" } }]
      }
    ]
  });

  it("creates a template, resolving its blocks then linking them", async () => {
    getTemplateBySlug.mockResolvedValueOnce(null);
    getBlockBySlug.mockResolvedValueOnce(null);
    createBlock.mockResolvedValueOnce(publicBlock({ id: 20, slug: "b", name: "b" }));
    createTemplate.mockResolvedValueOnce(publicTemplate({ id: 30 }));
    addTemplateBlock.mockResolvedValueOnce({ success: true, data: null });

    const res = await importPromptExport(templatePayload);
    expect(createTemplate).toHaveBeenCalledWith({ name: "t", description: null, is_public: false });
    expect(addTemplateBlock).toHaveBeenCalledWith(30, 20, 0);
    expect(res.templates.created).toEqual([{ slug: "t", name: "t" }]);
    expect(res.blocks.created).toEqual([{ slug: "b", name: "b" }]);
  });

  it("skips a template whose slug already exists (no blocks created)", async () => {
    getTemplateBySlug.mockResolvedValueOnce(publicTemplate({ id: 99 }));
    const res = await importPromptExport(templatePayload);
    expect(createTemplate).not.toHaveBeenCalled();
    expect(createBlock).not.toHaveBeenCalled();
    expect(res.templates.skipped).toEqual([{ slug: "t", name: "t" }]);
  });

  it("creates a slugless template directly", async () => {
    createTemplate.mockResolvedValueOnce(publicTemplate({ id: 31 }));
    const res = await importPromptExport(
      envelope({ templates: [{ name: "t2", is_public: false }] })
    );
    expect(getTemplateBySlug).not.toHaveBeenCalled();
    expect(addTemplateBlock).not.toHaveBeenCalled();
    expect(res.templates.created).toEqual([{ slug: null, name: "t2" }]);
  });
});
