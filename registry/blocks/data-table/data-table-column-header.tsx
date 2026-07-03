"use client";

import type * as React from "react";
import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DataTableColumnHeaderLabels {
  ascOrder: string;
  descOrder: string;
  hideColumn: string;
}

const DEFAULT_LABELS: DataTableColumnHeaderLabels = {
  ascOrder: "Ascending",
  descOrder: "Descending",
  hideColumn: "Hide column",
};

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
  labels?: Partial<DataTableColumnHeaderLabels>;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
  labels,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const t = { ...DEFAULT_LABELS, ...labels };
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
          >
            <span>{title}</span>
            {column.getIsSorted() === "desc" ? (
              <ArrowDown className="ml-2 size-4" />
            ) : column.getIsSorted() === "asc" ? (
              <ArrowUp className="ml-2 size-4" />
            ) : (
              <ChevronsUpDown className="ml-2 size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="mr-2 size-3.5 text-muted-foreground/70" />
            {t.ascOrder}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="mr-2 size-3.5 text-muted-foreground/70" />
            {t.descOrder}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="mr-2 size-3.5 text-muted-foreground/70" />
            {t.hideColumn}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
