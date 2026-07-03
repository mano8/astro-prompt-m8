import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/client.js", () => ({
  request: requestMock
}));

import * as blocks from "../src/runtime/api/blocks.js";
import * as templates from "../src/runtime/api/templates.js";
import * as categories from "../src/runtime/api/categories.js";
import * as dashboard from "../src/runtime/api/dashboard.js";
import * as admin from "../src/runtime/api/admin.js";
import * as index from "../src/runtime/api/index.js";

function lastOptions() {
  return requestMock.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({});
});

function validBlock() {
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

function validTemplate() {
  return { id: 1, name: "n", slug: "n", description: null, is_public: false, blocks: [] };
}

function validTemplateBlock() {
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

describe("blocks API", () => {
  it("list forwards skip/limit query and parses the schema", async () => {
    requestMock.mockResolvedValueOnce({ data: [validBlock()], count: 1 });
    const out = await blocks.listBlocks({ skip: 1, limit: 5 });
    expect(out.count).toBe(1);
    expect(lastOptions()).toMatchObject({ method: "GET", path: "/prompt-block/", auth: true });
    expect(lastOptions().query).toEqual({ skip: 1, limit: 5 });
  });

  it("list uses defaults when no params", async () => {
    requestMock.mockResolvedValueOnce({ data: [], count: 0 });
    await blocks.listBlocks();
    expect(lastOptions().query).toEqual({ skip: 0, limit: 100 });
  });

  it("getBlock returns the data shape when success", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: validBlock() });
    expect((await blocks.getBlock(7)).id).toBe(1);
    expect(lastOptions().path).toBe("/prompt-block/get/7/");
  });

  it("getBlock throws when data is null", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: null });
    await expect(blocks.getBlock(1)).rejects.toThrow(/no data/);
  });

  it("getBlockBySlug returns null on a ResponseMessage", async () => {
    requestMock.mockResolvedValueOnce({ success: false, msg: "Item not found." });
    expect(await blocks.getBlockBySlug("missing")).toBeNull();
    expect(lastOptions().path).toBe("/prompt-block/get_by_slug/missing/");
  });

  it("getBlockBySlug returns the block on a ResponseModelBase", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: validBlock() });
    expect((await blocks.getBlockBySlug("n")).id).toBe(1);
  });

  it("createBlock forwards the parsed body and returns data", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: validBlock() });
    const out = await blocks.createBlock({ name: "n", content: "c", type: "role" });
    expect(out.id).toBe(1);
    expect(lastOptions()).toMatchObject({ method: "POST", path: "/prompt-block/add/" });
  });

  it("updateBlock writes the body and returns data", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: validBlock() });
    expect((await blocks.updateBlock(1, { name: "n", content: "c", type: "role" })).id).toBe(1);
    expect(lastOptions()).toMatchObject({ method: "PUT", path: "/prompt-block/edit/1/" });
  });

  it("deleteBlock POSTs and returns the message", async () => {
    requestMock.mockResolvedValueOnce({ success: true, msg: "ok" });
    const out = await blocks.deleteBlock(1);
    expect(out.msg).toBe("ok");
    expect(lastOptions()).toMatchObject({ method: "DELETE", path: "/prompt-block/delete/1/" });
  });
});

describe("templates API", () => {
  it("list forwards skip/limit and parses the schema", async () => {
    requestMock.mockResolvedValueOnce({ data: [validTemplate()], count: 1 });
    const out = await templates.listTemplates({ skip: 2, limit: 3 });
    expect(out.count).toBe(1);
    expect(lastOptions()).toMatchObject({ method: "GET", path: "/prompt-template/" });
    expect(lastOptions().query).toEqual({ skip: 2, limit: 3 });
  });

  it("list uses defaults", async () => {
    requestMock.mockResolvedValueOnce({ data: [], count: 0 });
    await templates.listTemplates();
    expect(lastOptions().query).toEqual({ skip: 0, limit: 100 });
  });

  it("getTemplate returns the parsed template", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: validTemplate() });
    expect((await templates.getTemplate(2)).id).toBe(1);
    expect(lastOptions().path).toBe("/prompt-template/get/2/");
  });

  it("getTemplateBySlug returns null on a ResponseMessage", async () => {
    requestMock.mockResolvedValueOnce({ success: false, msg: "missing" });
    expect(await templates.getTemplateBySlug("missing")).toBeNull();
  });

  it("getTemplateBlocks returns the data array when given", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: [validTemplateBlock()] });
    expect((await templates.getTemplateBlocks(1)).length).toBe(1);
  });

  it("getTemplateBlocks returns [] on a ResponseMessage", async () => {
    requestMock.mockResolvedValueOnce({ success: false, msg: "Empty template blocks!" });
    expect(await templates.getTemplateBlocks(1)).toEqual([]);
  });

  it("compose posts dynamic replacement values and parses a ComposedPrompt", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: { content: "x" } });
    expect((await templates.composeTemplate(4, [{ id: 1, content: "replacement" }])).content).toBe(
      "x"
    );
    expect(lastOptions()).toMatchObject({
      method: "POST",
      path: "/prompt-template/compose/4/",
      body: [{ id: 1, content: "replacement" }]
    });
  });

  it("compose falls back to empty content when the service has no data", async () => {
    requestMock.mockResolvedValueOnce({ success: false, msg: "no data" });
    expect((await templates.composeTemplate(4)).content).toBe("");
  });

  it("createTemplate forwards body and returns parsed template", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: validTemplate() });
    expect((await templates.createTemplate({ name: "n" })).id).toBe(1);
    expect(lastOptions()).toMatchObject({ method: "POST", path: "/prompt-template/add/" });
  });

  it("updateTemplate writes body and returns parsed template", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: validTemplate() });
    expect((await templates.updateTemplate(5, { name: "n" })).id).toBe(1);
    expect(lastOptions()).toMatchObject({ method: "PUT", path: "/prompt-template/edit/5/" });
  });

  it("deleteTemplate returns the message", async () => {
    requestMock.mockResolvedValueOnce({ success: true, msg: "deleted" });
    expect((await templates.deleteTemplate(5)).msg).toBe("deleted");
  });

  it("addTemplateBlock forwards position as query", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: {} });
    await templates.addTemplateBlock(3, 4, 2);
    expect(lastOptions()).toMatchObject({
      method: "GET",
      path: "/prompt-template/3/add-block/4/",
      query: { position: 2 }
    });
  });

  it("addTemplateBlock defaults position to 0", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: {} });
    await templates.addTemplateBlock(3, 4);
    expect(lastOptions().query).toEqual({ position: 0 });
  });

  it("setTemplateBlockPosition forwards position as query", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: {} });
    await templates.setTemplateBlockPosition(3, 4, 5);
    expect(lastOptions()).toMatchObject({
      method: "GET",
      path: "/prompt-template/3/set-block-position/4/",
      query: { position: 5 }
    });
  });

  it("setTemplateBlockPosition defaults position to 1", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: {} });
    await templates.setTemplateBlockPosition(3, 4);
    expect(lastOptions().query).toEqual({ position: 1 });
  });

  it("removeTemplateBlock DELETEs the join row", async () => {
    requestMock.mockResolvedValueOnce({ success: true, msg: "removed" });
    await templates.removeTemplateBlock(3, 4);
    expect(lastOptions()).toMatchObject({
      method: "DELETE",
      path: "/prompt-template/3/delete-block/4/"
    });
  });

  it("getTemplateBlocks returns [] when data is null (ResponseModelBase shape but null)", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: null });
    expect(await templates.getTemplateBlocks(1)).toEqual([]);
  });

  it("compose returns {content: ''} when data is null/missing", async () => {
    requestMock.mockResolvedValueOnce({ success: true, data: null });
    expect((await templates.composeTemplate(1)).content).toBe("");
  });
});

describe("categories API", () => {
  it("list lets the schema accept null when nothing exists", async () => {
    requestMock.mockResolvedValueOnce(null);
    expect(await categories.listCategories({ skip: 1, limit: 2 })).toBeNull();
    expect(lastOptions()).toMatchObject({ method: "GET", path: "/category/" });
    expect(lastOptions().query).toEqual({ skip: 1, limit: 2 });
  });

  it("list defaults when no params", async () => {
    requestMock.mockResolvedValueOnce({ data: [], count: 0 });
    await categories.listCategories();
    expect(lastOptions().query).toEqual({ skip: 0, limit: 100 });
  });

  it("getCategory returns null on ResponseMessage", async () => {
    requestMock.mockResolvedValueOnce({ success: false, msg: "missing" });
    expect(await categories.getCategory(9)).toBeNull();
    expect(lastOptions().path).toBe("/category/get/9/");
  });

  it("getCategory returns the category on ResponseModelBase", async () => {
    requestMock.mockResolvedValueOnce({
      success: true,
      data: { id: 9, name: "x", slug: "x", type: "prompt_block", owner_id: "u1" }
    });
    expect((await categories.getCategory(9)).id).toBe(9);
  });

  it("createCategory parses the body and returns the data", async () => {
    requestMock.mockResolvedValueOnce({
      success: true,
      data: { id: 9, name: "x", slug: "x", type: "prompt_block", owner_id: "u1" }
    });
    expect((await categories.createCategory({ name: "x" })).id).toBe(9);
    expect(lastOptions()).toMatchObject({ method: "POST", path: "/category/add/" });
    expect((lastOptions() as { body: unknown }).body).toEqual({ name: "x" });
  });

  it("updateCategory forwards body and returns the data", async () => {
    requestMock.mockResolvedValueOnce({
      success: true,
      data: { id: 9, name: "y", slug: "y", type: "prompt_block", owner_id: "u1" }
    });
    expect((await categories.updateCategory(9, { name: "y" })).id).toBe(9);
    expect(lastOptions()).toMatchObject({ method: "PUT", path: "/category/edit/9/" });
  });

  it("deleteCategory returns the message", async () => {
    requestMock.mockResolvedValueOnce({ success: true, msg: "deleted" });
    expect((await categories.deleteCategory(9)).msg).toBe("deleted");
  });
});

describe("dashboard API", () => {
  it("activityAll and activityCurrent", async () => {
    await dashboard.getActivityAll();
    expect(lastOptions().path).toBe("/dashboard/users/activity/");
    await dashboard.getActivityCurrent();
    expect(lastOptions().path).toBe("/dashboard/users/activity/current/");
  });
});

describe("admin API", () => {
  it("aggregates the overview with admin guard on each request", async () => {
    const responses = [
      { data: [], count: 0 },
      { data: [], count: 0 },
      { data: [], count: 0 },
      { nb_users: 0, activity: { min: 0, max: 0, activity: [] } }
    ];
    requestMock.mockReset();
    for (const r of responses) requestMock.mockResolvedValueOnce(r);
    await admin.getAdminOverview();
    for (const [opts] of requestMock.mock.calls) {
      expect(opts.admin).toBe(true);
    }
  });
});

describe("api index", () => {
  it("exposes grouped namespaces that reuse the flat functions", async () => {
    requestMock.mockReset();
    requestMock.mockResolvedValue({ data: [], count: 0 });
    await index.blocks.list();
    await index.templates.list();
    await index.categories.list();
    await index.dashboard.activityAll();
    await index.admin.overview();
    expect(requestMock).toHaveBeenCalled();
    expect(index.blocks.create).toBe(blocks.createBlock);
    expect(index.templates.compose).toBe(templates.composeTemplate);
    expect(index.categories.delete).toBe(categories.deleteCategory);
    expect(index.dashboard.activityCurrent).toBe(dashboard.getActivityCurrent);
  });
});
