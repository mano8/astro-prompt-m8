import { describe, expect, it } from "vitest";
import { promptKeys } from "../src/runtime/queryKeys.js";

describe("promptKeys", () => {
  it("builds stable keys for block lists regardless of parameter order", () => {
    const first = promptKeys.blocks({ skip: 1, limit: 10 });
    const second = promptKeys.blocks({ limit: 10, skip: 1 });
    expect(first).toEqual(["prompt", "blocks", { limit: 10, skip: 1 }]);
    expect(second).toEqual(first);
  });

  it("uses an empty frozen params object when no argument is supplied", () => {
    expect(promptKeys.blocks(undefined)).toEqual(["prompt", "blocks", {}]);
    expect(promptKeys.templates()).toEqual(["prompt", "templates", {}]);
    expect(promptKeys.categories()).toEqual(["prompt", "categories", {}]);
  });

  it("builds stable keys for detail and admin scopes", () => {
    expect(promptKeys.all()).toEqual(["prompt"]);
    expect(promptKeys.blockLists()).toEqual(["prompt", "blocks"]);
    expect(promptKeys.blocks()).toEqual(["prompt", "blocks", {}]);
    expect(promptKeys.block(5)).toEqual(["prompt", "block", 5]);
    expect(promptKeys.blockSlug("s")).toEqual(["prompt", "block-slug", "s"]);
    expect(promptKeys.templateLists()).toEqual(["prompt", "templates"]);
    expect(promptKeys.templates()).toEqual(["prompt", "templates", {}]);
    expect(promptKeys.templates({ skip: 1 })).toEqual(["prompt", "templates", { skip: 1 }]);
    expect(promptKeys.template(7)).toEqual(["prompt", "template", 7]);
    expect(promptKeys.templateSlug("s")).toEqual(["prompt", "template-slug", "s"]);
    expect(promptKeys.templateBlocks(3)).toEqual(["prompt", "template-blocks", 3]);
    expect(promptKeys.compose(3)).toEqual(["prompt", "compose", 3]);
    expect(promptKeys.categoryLists()).toEqual(["prompt", "categories"]);
    expect(promptKeys.categories()).toEqual(["prompt", "categories", {}]);
    expect(promptKeys.categories({ skip: 1 })).toEqual(["prompt", "categories", { skip: 1 }]);
    expect(promptKeys.category(2)).toEqual(["prompt", "category", 2]);
    expect(promptKeys.adminOverview()).toEqual(["prompt", "admin", "overview"]);
    expect(promptKeys.dashboardActivity()).toEqual(["prompt", "dashboard", "activity"]);
    expect(promptKeys.dashboardActivityCurrent()).toEqual([
      "prompt",
      "dashboard",
      "activity-current"
    ]);
  });
});