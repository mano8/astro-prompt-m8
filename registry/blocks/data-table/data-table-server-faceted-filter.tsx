"use client";

import * as React from "react";
import { Check, PlusCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export interface FacetedFilterOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface DataTableServerFacetedFilterLabels {
  clear: string;
  empty: string;
  selected: (count: number) => string;
}

const DEFAULT_LABELS: DataTableServerFacetedFilterLabels = {
  clear: "Clear",
  empty: "No results found.",
  selected: (count) => `${count} selected`,
};

interface DataTableServerFacetedFilterProps<TFilter extends string> {
  title: string;
  options: FacetedFilterOption[];
  value: TFilter | "";
  onFilterChange: (value: TFilter | "") => void;
  labels?: Partial<DataTableServerFacetedFilterLabels>;
  multi?: boolean;
}

export function DataTableServerFacetedFilter<TFilter extends string>({
  title,
  options,
  value,
  onFilterChange,
  labels,
  multi = true,
}: DataTableServerFacetedFilterProps<TFilter>) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const selected = React.useMemo<Set<string>>(() => {
    if (!value) return new Set<string>();
    return multi ? new Set(String(value).split(",").filter(Boolean)) : new Set([String(value)]);
  }, [multi, value]);

  const selectedCount = selected.size;

  const toggleMulti = (nextValue: string) => {
    const next = new Set(selected);
    if (next.has(nextValue)) {
      next.delete(nextValue);
    } else {
      next.add(nextValue);
    }
    onFilterChange((Array.from(next).join(",") as TFilter) || "");
  };

  const chooseSingle = (nextValue: string) => {
    const current = selected.values().next().value as string | undefined;
    onFilterChange(current === nextValue ? "" : (nextValue as TFilter));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="mr-2 size-4" />
          {title}
          {selectedCount > 0 ? (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selectedCount}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedCount > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {t.selected(selectedCount)}
                  </Badge>
                ) : (
                  options
                    .filter((option) => selected.has(option.value))
                    .map((option) => (
                      <Badge
                        key={option.value}
                        variant="secondary"
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{t.empty}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (multi) {
                        toggleMulti(option.value);
                      } else {
                        chooseSingle(option.value);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    {option.icon ? (
                      <option.icon className="mr-2 size-4 text-muted-foreground" />
                    ) : null}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedCount > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onFilterChange("")} className="justify-center">
                    {t.clear}
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
