"use client";

import * as React from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  DataTablePagination,
  type DataTablePaginationLabels,
} from "./data-table-pagination";
import {
  DataTableServerToolbar,
  type DataTableFilterOptions,
  type DataTableServerToolbarLabels,
} from "./data-table-server-toolbar";

export type DataTableSortDirection = "asc" | "desc";

export interface DataTableFilter {
  columnId?: string;
  label: string;
  allLabel?: string;
  options: { label: string; value: string }[];
  multi?: boolean;
}

export interface DataTableServerLabels {
  loading: string;
  empty: string;
  toolbar: Partial<DataTableServerToolbarLabels>;
  pagination: Partial<DataTablePaginationLabels>;
}

const DEFAULT_LABELS: DataTableServerLabels = {
  loading: "Loading...",
  empty: "No results.",
  toolbar: {},
  pagination: {},
};

export interface DataTableServerProps<TData, TValue, TFilter extends string = string> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  addButton?: React.ReactNode;
  rowCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  visibility?: VisibilityState;
  sortBy?: string;
  sortDir?: DataTableSortDirection;
  onSortChange?: (sortBy?: string, sortDir?: DataTableSortDirection) => void;
  q?: string;
  onSearchChange?: (q: string) => void;
  f?: TFilter | "";
  onFilterChange?: (f: TFilter | "") => void;
  filterOptions?: DataTableFilterOptions;
  pageSizeOptions?: number[];
  labels?: Partial<DataTableServerLabels>;
}

export function DataTableServer<TData, TValue, TFilter extends string = string>({
  columns,
  data,
  visibility = {},
  loading = false,
  addButton,
  rowCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortDir,
  onSortChange,
  q,
  onSearchChange,
  f,
  onFilterChange,
  filterOptions,
  pageSizeOptions,
  labels,
}: DataTableServerProps<TData, TValue, TFilter>) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(visibility);

  const sortingState: SortingState = React.useMemo(
    () => (sortBy && sortDir ? [{ id: sortBy, desc: sortDir === "desc" }] : []),
    [sortBy, sortDir],
  );
  const pageIndex = Math.max(0, page - 1);
  const pageCount = Math.max(1, Math.ceil(rowCount / Math.max(1, pageSize)));
  const paginationState = React.useMemo(
    () => ({ pageIndex, pageSize }),
    [pageIndex, pageSize],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: sortingState,
      columnVisibility,
      rowSelection,
      pagination: paginationState,
    },
    manualPagination: true,
    manualSorting: Boolean(onSortChange),
    manualFiltering: Boolean(onSearchChange || onFilterChange),
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetPageIndex: false,
    autoResetExpanded: false,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(paginationState) : updater;
      if (next.pageIndex !== paginationState.pageIndex) {
        onPageChange(next.pageIndex + 1);
      }
      if (next.pageSize !== paginationState.pageSize) {
        onPageSizeChange(next.pageSize);
      }
    },
    onSortingChange: (updater) => {
      if (!onSortChange) return;
      const next = typeof updater === "function" ? updater(sortingState) : updater;
      const first = next[0];
      onSortChange(first?.id, first ? (first.desc ? "desc" : "asc") : undefined);
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
  });

  return (
    <div className="space-y-4">
      <DataTableServerToolbar
        table={table}
        addButton={addButton}
        q={q}
        onSearchChange={onSearchChange}
        f={f}
        onFilterChange={onFilterChange}
        filterOptions={filterOptions}
        labels={t.toolbar}
      />
      <DataTablePagination
        table={table}
        labels={t.pagination}
        pageSizeOptions={pageSizeOptions}
      />
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t.loading}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {t.empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        table={table}
        labels={t.pagination}
        pageSizeOptions={pageSizeOptions}
      />
    </div>
  );
}

export const DataTable = DataTableServer;
export type { DataTableFilterOptions };
