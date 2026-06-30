import { describe, expect, it } from "vitest";
import { makeListSchema, mergeAndNormalize, parseListUrlParams, stringifyListUrlParams } from "../src/runtime/listParams.js";

const schema = () =>
  makeListSchema({
    allowedSorts: ["name", "position"],
    allowedPageSizes: [10, 20, 40],
    defaultSort: "name",
    defaultOrder: "asc",
    defaultPage: 1,
    defaultPageSize: 20
  });

describe("list params helpers", () => {
  it("parses URLSearchParams with normalized search, numeric values, sorting, and order", () => {
    const params = new URLSearchParams({
      page: "3",
      pageSize: "40",
      q: "  role   prompt  ",
      sort: "position",
      order: "DESC"
    });
    expect(parseListUrlParams(schema(), params)).toEqual({
      page: 3,
      pageSize: 40,
      q: "role prompt",
      sort: "position",
      order: "desc"
    });
  });

  it("falls back to Zod-backed defaults for invalid URL values", () => {
    const params = new URLSearchParams({
      page: "0",
      pageSize: "99",
      q: "   ",
      sort: "unknown",
      order: "sideways"
    });
    expect(parseListUrlParams(schema(), params)).toEqual({
      page: 1,
      pageSize: 20,
      q: "",
      sort: "name",
      order: "asc"
    });
  });

  it("parses plain objects and uses the first non-null array value", () => {
    expect(
      parseListUrlParams(schema(), {
        page: 2,
        pageSize: [null, 10],
        q: ["", "ignored"],
        sort: "position",
        order: "asc"
      })
    ).toEqual({
      page: 2,
      pageSize: 10,
      q: "",
      sort: "position",
      order: "asc"
    });
  });

  it("merges URLSearchParams with plain object patches and normalizes the result", () => {
    const current = new URLSearchParams({
      page: "4",
      pageSize: "20",
      q: "role",
      sort: "position",
      order: "desc"
    });
    expect(
      mergeAndNormalize(schema(), current, {
        page: 1,
        q: "  hero   template ",
        order: "asc"
      })
    ).toEqual({
      page: 1,
      pageSize: 20,
      q: "hero template",
      sort: "position",
      order: "asc"
    });
  });

  it("stringifies list params in a stable order and omits an empty search", () => {
    const params = parseListUrlParams(schema(), {
      page: 1,
      pageSize: 20,
      q: "",
      sort: "name",
      order: "asc"
    });
    expect(stringifyListUrlParams(params)).toBe("page=1&pageSize=20&sort=name&order=asc");
    expect(stringifyListUrlParams({ ...params, q: "hero template" })).toBe(
      "page=1&pageSize=20&q=hero+template&sort=name&order=asc"
    );
  });

  it("supports implicit defaults from the first allowed sort and page size", () => {
    const s = makeListSchema({
      allowedSorts: ["name", "position"],
      allowedPageSizes: [10, 20]
    });
    expect(parseListUrlParams(s, {})).toEqual({
      page: 1,
      pageSize: 10,
      q: "",
      sort: "name",
      order: "desc"
    });
  });

  it("rejects invalid helper defaults at construction time", () => {
    expect(() =>
      makeListSchema({ allowedSorts: ["name"], allowedPageSizes: [10], defaultSort: "x" as "name" })
    ).toThrow("defaultSort must be one of allowedSorts");
    expect(() =>
      makeListSchema({ allowedSorts: ["name"], allowedPageSizes: [10], defaultPageSize: 25 })
    ).toThrow("defaultPageSize must be one of allowedPageSizes");
    expect(() =>
      makeListSchema({ allowedSorts: ["name"], allowedPageSizes: [10], defaultPage: 0 })
    ).toThrow("defaultPage must be a positive integer");
  });
});