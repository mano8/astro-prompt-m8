import { describe, expect, it } from "vitest";
import {
  listParamsToOffset,
  makeListSchema,
  mergeAndNormalize,
  parseListUrlParams,
  stringifyListUrlParams
} from "../src/runtime/listParams.js";

const schema = () =>
  makeListSchema({
    allowedSorts: ["name", "position"],
    allowedSearch: ["slug", "type"],
    allowedFilters: ["public", "private"],
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
      csrc: "slug",
      vsrc: "hero",
      f: "public",
      sort: "position",
      order: "DESC"
    });
    expect(parseListUrlParams(schema(), params)).toEqual({
      page: 3,
      pageSize: 40,
      q: "role prompt",
      csrc: "slug",
      vsrc: "hero",
      f: "public",
      sort: "position",
      order: "desc"
    });
  });

  it("falls back to Zod-backed defaults for invalid URL values", () => {
    const params = new URLSearchParams({
      page: "0",
      pageSize: "99",
      q: "   ",
      csrc: "unknown",
      vsrc: "  value  ",
      f: "archived",
      sort: "unknown",
      order: "sideways"
    });
    expect(parseListUrlParams(schema(), params)).toEqual({
      page: 1,
      pageSize: 20,
      q: "",
      csrc: "",
      vsrc: "value",
      f: "",
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
        csrc: "type",
        vsrc: ["format", "ignored"],
        f: "private",
        sort: "position",
        order: "asc"
      })
    ).toEqual({
      page: 2,
      pageSize: 10,
      q: "",
      csrc: "type",
      vsrc: "format",
      f: "private",
      sort: "position",
      order: "asc"
    });
  });

  it("merges URLSearchParams with plain object patches and normalizes the result", () => {
    const current = new URLSearchParams({
      page: "4",
      pageSize: "20",
      q: "role",
      f: "public",
      sort: "position",
      order: "desc"
    });
    expect(
      mergeAndNormalize(schema(), current, {
        page: 1,
        q: "  hero   template ",
        f: "private",
        order: "asc"
      })
    ).toEqual({
      page: 1,
      pageSize: 20,
      q: "hero template",
      csrc: "",
      vsrc: "",
      f: "private",
      sort: "position",
      order: "asc"
    });
  });

  it("stringifies list params in a stable order and omits an empty search", () => {
    const params = parseListUrlParams(schema(), {
      page: 1,
      pageSize: 20,
      q: "",
      csrc: "",
      vsrc: "",
      f: "",
      sort: "name",
      order: "asc"
    });
    expect(stringifyListUrlParams(params)).toBe("page=1&pageSize=20&sort=name&order=asc");
    expect(stringifyListUrlParams({ ...params, q: "hero template" })).toBe(
      "page=1&pageSize=20&q=hero+template&sort=name&order=asc"
    );
    expect(stringifyListUrlParams({ ...params, q: "hero template" }, undefined)).toBe(
      "page=1&pageSize=20&q=hero+template&sort=name&order=asc"
    );
    expect(stringifyListUrlParams({ ...params, q: "hero template" }, params)).toBe(
      "q=hero+template"
    );
    expect(stringifyListUrlParams(params, params)).toBe("");
    expect(stringifyListUrlParams({ ...params, page: 2, f: "public" }, params)).toBe(
      "page=2&f=public"
    );
    expect(
      stringifyListUrlParams(
        { ...params, csrc: "slug", vsrc: "hero-template" },
        params
      )
    ).toBe("csrc=slug&vsrc=hero-template");
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
      csrc: "",
      vsrc: "",
      f: "",
      sort: "name",
      order: "desc"
    });
  });

  it("translates normalized page params into backend offset params", () => {
    expect(listParamsToOffset({ page: 3, pageSize: 20 })).toEqual({
      skip: 40,
      limit: 20
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
    expect(() =>
      makeListSchema({
        allowedSorts: ["name"],
        allowedSearch: ["slug"],
        allowedPageSizes: [10],
        defaultSearchColumn: "type" as "slug"
      })
    ).toThrow("defaultSearchColumn must be one of allowedSearch");
    expect(() =>
      makeListSchema({
        allowedSorts: ["name"],
        allowedFilters: ["public"],
        allowedPageSizes: [10],
        defaultFilter: "private" as "public"
      })
    ).toThrow("defaultFilter must be one of allowedFilters");
  });
});
