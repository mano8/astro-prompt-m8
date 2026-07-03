"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DataTablePaginationLabels {
  selectedRows: (selected: number, total: number) => string;
  rowsPerPage: string;
  currentPage: (current: number, total: number) => string;
  goToFirstPage: string;
  goToPreviousPage: string;
  goToNextPage: string;
  goToLastPage: string;
}

const DEFAULT_LABELS: DataTablePaginationLabels = {
  selectedRows: (selected, total) => `${selected} of ${total} selected`,
  rowsPerPage: "Rows per page",
  currentPage: (current, total) => `Page ${current} of ${total}`,
  goToFirstPage: "Go to first page",
  goToPreviousPage: "Go to previous page",
  goToNextPage: "Go to next page",
  goToLastPage: "Go to last page",
};

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  labels?: Partial<DataTablePaginationLabels>;
  pageSizeOptions?: number[];
}

export function DataTablePagination<TData>({
  table,
  labels,
  pageSizeOptions = [10, 20, 30, 40, 50],
}: DataTablePaginationProps<TData>) {
  const t = { ...DEFAULT_LABELS, ...labels };
  return (
    <div className="flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 text-sm text-muted-foreground">
        {t.selectedRows(
          table.getFilteredSelectedRowModel().rows.length,
          table.getFilteredRowModel().rows.length,
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">{t.rowsPerPage}</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          {t.currentPage(table.getState().pagination.pageIndex + 1, table.getPageCount())}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{t.goToFirstPage}</span>
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">{t.goToPreviousPage}</span>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{t.goToNextPage}</span>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">{t.goToLastPage}</span>
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
