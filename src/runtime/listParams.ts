import { z } from "zod";

export const listSortDirections = ["asc", "desc"] as const;

export type ListSortDirection = (typeof listSortDirections)[number];
export type ListParamPrimitive = string | number | boolean | null | undefined;
export type ListParamRecord = Record<string, ListParamPrimitive | readonly ListParamPrimitive[]>;
export type ListParamSource = URLSearchParams | ListParamRecord;

export interface ListParams<
  TSort extends string,
  TSearch extends string = string,
  TFilter extends string = string
> {
  page: number;
  pageSize: number;
  q: string;
  csrc: TSearch | "";
  vsrc: string;
  f: TFilter | "";
  sort: TSort;
  order: ListSortDirection;
}

export interface MakeListSchemaOptions<
  TSort extends string,
  TSearch extends string = string,
  TFilter extends string = string
> {
  allowedSorts: readonly [TSort, ...TSort[]];
  allowedPageSizes: readonly [number, ...number[]];
  allowedSearch?: readonly TSearch[];
  allowedFilters?: readonly TFilter[];
  defaultSort?: TSort;
  defaultSearchColumn?: TSearch | "";
  defaultFilter?: TFilter | "";
  defaultOrder?: ListSortDirection;
  defaultPage?: number;
  defaultPageSize?: number;
  defaultSearchValue?: string;
  defaultQuery?: string;
}

export type ListParamsSchema<
  TSort extends string,
  TSearch extends string = string,
  TFilter extends string = string
> = z.ZodType<ListParams<TSort, TSearch, TFilter>>;

const coerceNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return value;
};

const coerceOrder = (value: unknown) =>
  typeof value === "string" ? value.toLowerCase() : value;

const normalizeSearch = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const normalizeString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const firstRecordValue = (value: ListParamRecord[string]) => {
  if (Array.isArray(value)) {
    return value.find((item) => item != null);
  }
  return value;
};

const toPlainParams = (source: ListParamSource): Record<string, unknown> => {
  if (source instanceof URLSearchParams) {
    return Object.fromEntries(source.entries());
  }

  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, firstRecordValue(value)])
  );
};

function enumOrEmptySchema<TValue extends string>(
  values: readonly TValue[] | undefined,
  fallback: TValue | ""
) {
  return z.preprocess(normalizeString, z.string()).transform((value) => {
    if (value === "") {
      return fallback;
    }
    return values?.includes(value as TValue) ? (value as TValue) : fallback;
  });
}

export function makeListSchema<
  TSort extends string,
  TSearch extends string = string,
  TFilter extends string = string
>(
  options: MakeListSchemaOptions<TSort, TSearch, TFilter>
): ListParamsSchema<TSort, TSearch, TFilter> {
  const defaultSort = options.defaultSort ?? options.allowedSorts[0];
  const defaultOrder = options.defaultOrder ?? "desc";
  const defaultPage = options.defaultPage ?? 1;
  const defaultPageSize = options.defaultPageSize ?? options.allowedPageSizes[0];
  const defaultQuery = options.defaultQuery ?? "";
  const defaultSearchColumn = options.defaultSearchColumn ?? "";
  const defaultSearchValue = options.defaultSearchValue ?? "";
  const defaultFilter = options.defaultFilter ?? "";
  const allowedPageSizes = new Set(options.allowedPageSizes);

  if (!options.allowedSorts.includes(defaultSort)) {
    throw new Error("defaultSort must be one of allowedSorts");
  }
  if (!allowedPageSizes.has(defaultPageSize)) {
    throw new Error("defaultPageSize must be one of allowedPageSizes");
  }
  if (!Number.isInteger(defaultPage) || defaultPage < 1) {
    throw new Error("defaultPage must be a positive integer");
  }
  if (defaultSearchColumn !== "" && !options.allowedSearch?.includes(defaultSearchColumn)) {
    throw new Error("defaultSearchColumn must be one of allowedSearch");
  }
  if (defaultFilter !== "" && !options.allowedFilters?.includes(defaultFilter)) {
    throw new Error("defaultFilter must be one of allowedFilters");
  }

  return z.object({
    page: z.preprocess(coerceNumber, z.number().int().min(1).catch(defaultPage)),
    pageSize: z
      .preprocess(
        coerceNumber,
        z.number().int().refine((value) => allowedPageSizes.has(value)).catch(defaultPageSize)
      ),
    q: z.preprocess(normalizeSearch, z.string().catch(defaultQuery)),
    csrc: enumOrEmptySchema(options.allowedSearch, defaultSearchColumn),
    vsrc: z.preprocess(normalizeString, z.string().catch(defaultSearchValue)),
    f: enumOrEmptySchema(options.allowedFilters, defaultFilter),
    sort: z.enum(options.allowedSorts).catch(defaultSort),
    order: z.preprocess(coerceOrder, z.enum(listSortDirections).catch(defaultOrder))
  }).strip();
}

export function parseListUrlParams<
  TSort extends string,
  TSearch extends string = string,
  TFilter extends string = string
>(
  schema: ListParamsSchema<TSort, TSearch, TFilter>,
  source: ListParamSource
): ListParams<TSort, TSearch, TFilter> {
  return schema.parse(toPlainParams(source));
}

export function mergeAndNormalize<
  TSort extends string,
  TSearch extends string = string,
  TFilter extends string = string
>(
  schema: ListParamsSchema<TSort, TSearch, TFilter>,
  current: ListParamSource,
  patch: ListParamSource
): ListParams<TSort, TSearch, TFilter> {
  return schema.parse({ ...toPlainParams(current), ...toPlainParams(patch) });
}

export function listParamsToOffset(params: Pick<ListParams<string>, "page" | "pageSize">): {
  skip: number;
  limit: number;
} {
  return {
    skip: Math.max(0, (params.page - 1) * params.pageSize),
    limit: params.pageSize
  };
}

export function stringifyListUrlParams<
  TSort extends string,
  TSearch extends string = string,
  TFilter extends string = string
>(
  params: ListParams<TSort, TSearch, TFilter>,
  defaults?: ListParams<TSort, TSearch, TFilter>
): string {
  const query = new URLSearchParams();
  if (!defaults || params.page !== defaults.page) {
    query.set("page", String(params.page));
  }
  if (!defaults || params.pageSize !== defaults.pageSize) {
    query.set("pageSize", String(params.pageSize));
  }
  if (params.q !== "" && (!defaults || params.q !== defaults.q)) {
    query.set("q", params.q);
  }
  if (params.csrc !== "" && (!defaults || params.csrc !== defaults.csrc)) {
    query.set("csrc", params.csrc);
  }
  if (params.vsrc !== "" && (!defaults || params.vsrc !== defaults.vsrc)) {
    query.set("vsrc", params.vsrc);
  }
  if (params.f !== "" && (!defaults || params.f !== defaults.f)) {
    query.set("f", params.f);
  }
  if (!defaults || params.sort !== defaults.sort) {
    query.set("sort", params.sort);
  }
  if (!defaults || params.order !== defaults.order) {
    query.set("order", params.order);
  }
  return query.toString();
}
