"use client";

import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DataTableViewOptionsLabels {
  view: string;
  toggleColumns: string;
}

const DEFAULT_LABELS: DataTableViewOptionsLabels = {
  view: "View",
  toggleColumns: "Toggle columns",
};

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  labels?: Partial<DataTableViewOptionsLabels>;
}

export function DataTableViewOptions<TData>({
  table,
  labels,
}: DataTableViewOptionsProps<TData>) {
  const t = { ...DEFAULT_LABELS, ...labels };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto h-8">
          <Settings2 className="mr-2 size-4" />
          {t.view}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[170px]">
        <DropdownMenuLabel>{t.toggleColumns}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
            >
              {column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
