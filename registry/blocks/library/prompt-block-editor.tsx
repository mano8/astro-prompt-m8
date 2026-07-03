"use client";

// Full shadcn prompt-block editor skin. State and API calls come from the
// package hook; forms are validated with Zod before create/update.
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePromptBlocks } from "@mano8/astro-prompt-m8/hooks";
import {
  hasDynamicContentPlaceholder,
  insertDynamicContentPlaceholder,
  type PromptBlockPublic,
} from "@mano8/astro-prompt-m8/schemas";

import {
  DataTable,
  type DataTableFilterOptions,
  type DataTableSortDirection,
} from "@/components/fa-prompt/data-table";
import { DataTableColumnHeader } from "@/components/fa-prompt/data-table-column-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface PromptBlockEditorLabels {
  title: string;
  subtitle: string;
  create: string;
  edit: string;
  deleteLabel: string;
  deleteTitle: string;
  deleteDescription: string;
  save: string;
  cancel: string;
  actions: string;
  name: string;
  description: string;
  content: string;
  type: string;
  dynamicLabel: string;
  publicLabel: string;
  insertPlaceholder: string;
  placeholderRequired: string;
  loading: string;
  empty: string;
  error: string;
  search: string;
  allTypes: string;
  allDynamic: string;
  allPublic: string;
  columns: string;
  selected: (selected: number, total: number) => string;
}

const DEFAULT_LABELS: PromptBlockEditorLabels = {
  title: "Prompt blocks",
  subtitle: "Search, filter, select columns, and maintain reusable prompt blocks.",
  create: "New block",
  edit: "Edit",
  deleteLabel: "Delete",
  deleteTitle: "Delete prompt block?",
  deleteDescription: "This removes the block if no template still depends on it.",
  save: "Save",
  cancel: "Cancel",
  actions: "Actions",
  name: "Name",
  description: "Description",
  content: "Content",
  type: "Type",
  dynamicLabel: "Dynamic",
  publicLabel: "Public",
  insertPlaceholder: "Insert placeholder",
  placeholderRequired: "Dynamic blocks should include {{dynamic_content}}.",
  loading: "Loading...",
  empty: "No prompt blocks.",
  error: "Could not load prompt blocks.",
  search: "Search blocks...",
  allTypes: "All types",
  allDynamic: "Dynamic + static",
  allPublic: "Public + private",
  columns: "Columns",
  selected: (selected, total) => `${selected} of ${total} selected`,
};

const blockTypes = ["role", "task", "context", "instruction", "example", "format"] as const;
type BlockTableFilter = (typeof blockTypes)[number] | "dynamic" | "static" | "public" | "private";
type BlockSort = "name" | "type" | "dynamic" | "visibility";

interface BlockTableParams {
  page: number;
  pageSize: number;
  q: string;
  f: string;
  sort: BlockSort;
  order: DataTableSortDirection;
}

const DEFAULT_TABLE_PARAMS: BlockTableParams = {
  page: 1,
  pageSize: 10,
  q: "",
  f: "",
  sort: "name",
  order: "asc",
};
const blockFormSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(1000).optional(),
    content: z.string().min(1).max(5000).refine((value) => value.trim().length > 0),
    type: z.enum(blockTypes),
    is_dynamic: z.boolean(),
    is_public: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.is_dynamic && !hasDynamicContentPlaceholder(value.content)) {
      context.addIssue({
        code: "custom",
        path: ["content"],
        message: DEFAULT_LABELS.placeholderRequired,
      });
    }
  });
type BlockFormValues = z.infer<typeof blockFormSchema>;

const emptyValues: BlockFormValues = {
  name: "",
  description: "",
  content: "",
  type: "role",
  is_dynamic: false,
  is_public: false,
};

export interface PromptBlockEditorProps {
  labels?: Partial<PromptBlockEditorLabels>;
}

function formatBool(value: boolean, yes: string, no: string) {
  return value ? yes : no;
}

export default function PromptBlockEditor({ labels }: PromptBlockEditorProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const { data, loading, error, createMutation, updateMutation, deleteMutation, refresh } =
    usePromptBlocks();
  const [editing, setEditing] = React.useState<PromptBlockPublic | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PromptBlockPublic | null>(null);
  const [tableParams, setTableParams] =
    React.useState<BlockTableParams>(DEFAULT_TABLE_PARAMS);

  const form = useForm<BlockFormValues>({
    resolver: zodResolver(blockFormSchema),
    defaultValues: emptyValues,
  });
  const isDynamic = form.watch("is_dynamic");

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const startCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setOpen(true);
  };

  const startEdit = (block: PromptBlockPublic) => {
    setEditing(block);
    form.reset({
      name: block.name,
      description: block.description ?? "",
      content: block.content,
      type: block.type,
      is_dynamic: block.is_dynamic,
      is_public: block.is_public,
    });
    setOpen(true);
  };

  const save = async (values: BlockFormValues) => {
    const body = {
      ...values,
      description: values.description?.trim() ? values.description.trim() : null,
    };
    if (editing) {
      await updateMutation.mutateAsync({ blockId: editing.id, body });
    } else {
      await createMutation.mutateAsync(body);
    }
    setOpen(false);
    setEditing(null);
  };

  const columns = React.useMemo<ColumnDef<PromptBlockPublic>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.name} />
        ),
        enableSorting: true,
      },
      {
        id: "actions",
        header: t.actions,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-32 flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => startEdit(row.original)}
            >
              {t.edit}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => setDeleting(row.original)}
            >
              {t.deleteLabel}
            </Button>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => <DataTableColumnHeader column={column} title={t.type} />,
        enableSorting: true,
      },
      {
        accessorFn: (row) => (row.is_dynamic ? "dynamic" : "static"),
        id: "dynamic",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.dynamicLabel} />
        ),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={row.original.is_dynamic ? "default" : "secondary"}>
            {formatBool(row.original.is_dynamic, "Dynamic", "Static")}
          </Badge>
        ),
      },
      {
        accessorFn: (row) => (row.is_public ? "public" : "private"),
        id: "visibility",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t.publicLabel} />
        ),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={row.original.is_public ? "default" : "outline"}>
            {formatBool(row.original.is_public, "Public", "Private")}
          </Badge>
        ),
      },
      {
        accessorKey: "description",
        header: t.description,
        cell: ({ row }) => (
          <p className="line-clamp-3 max-w-xl whitespace-pre-wrap text-muted-foreground">
            {row.original.description ?? ""}
          </p>
        ),
      },
      {
        accessorKey: "content",
        header: t.content,
        cell: ({ row }) => (
          <p className="line-clamp-2 max-w-xl whitespace-pre-wrap text-muted-foreground">
            {row.original.content}
          </p>
        ),
      },
    ],
    [t],
  );

  const filterOptions: DataTableFilterOptions = {
    title: t.type,
    options: [
      ...blockTypes.map((type) => ({ label: type, value: type })),
      { label: "Dynamic", value: "dynamic" },
      { label: "Static", value: "static" },
      { label: "Public", value: "public" },
      { label: "Private", value: "private" },
    ],
  };

  const filteredBlocks = React.useMemo(() => {
    const q = tableParams.q.trim().toLowerCase();
    const rows = (data?.data ?? []).filter((block) => {
      const matchesQuery =
        q === "" ||
        block.name.toLowerCase().includes(q) ||
        block.description?.toLowerCase().includes(q) ||
        block.content.toLowerCase().includes(q);
      const activeFilters = tableParams.f ? tableParams.f.split(",") : [];
      const matchesFilter =
        activeFilters.length === 0 ||
        activeFilters.some((filter) => {
          if (filter === "dynamic") return block.is_dynamic;
          if (filter === "static") return !block.is_dynamic;
          if (filter === "public") return block.is_public;
          if (filter === "private") return !block.is_public;
          return block.type === filter;
        });
      return matchesQuery && matchesFilter;
    });
    const direction = tableParams.order === "desc" ? -1 : 1;
    return rows.sort((left, right) => {
      const leftValue =
        tableParams.sort === "dynamic"
          ? String(left.is_dynamic)
          : tableParams.sort === "visibility"
            ? String(left.is_public)
            : String(left[tableParams.sort]);
      const rightValue =
        tableParams.sort === "dynamic"
          ? String(right.is_dynamic)
          : tableParams.sort === "visibility"
            ? String(right.is_public)
            : String(right[tableParams.sort]);
      return leftValue.localeCompare(rightValue) * direction;
    });
  }, [data?.data, tableParams]);

  const pagedBlocks = React.useMemo(() => {
    const start = (tableParams.page - 1) * tableParams.pageSize;
    return filteredBlocks.slice(start, start + tableParams.pageSize);
  }, [filteredBlocks, tableParams.page, tableParams.pageSize]);

  return (
    <section className="not-content space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2 pb-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button type="button" onClick={startCreate}>
          <Plus className="mr-2 size-4" />
          {t.create}
        </Button>
      </div>

      {loading && !data ? <p className="text-sm text-muted-foreground">{t.loading}</p> : null}
      {error && !data ? (
        <p role="alert" className="text-sm text-destructive">
          {t.error}
        </p>
      ) : null}

      <DataTable
        key="prompt-block-table-actions-v2"
        columns={columns}
        data={pagedBlocks}
        loading={loading}
        rowCount={filteredBlocks.length}
        page={tableParams.page}
        pageSize={tableParams.pageSize}
        onPageChange={(page) => setTableParams((current) => ({ ...current, page }))}
        onPageSizeChange={(pageSize) =>
          setTableParams((current) => ({ ...current, page: 1, pageSize }))
        }
        sortBy={tableParams.sort}
        sortDir={tableParams.order}
        onSortChange={(sort, order) =>
          setTableParams((current) => ({
            ...current,
            page: 1,
            sort: (sort as BlockSort | undefined) ?? DEFAULT_TABLE_PARAMS.sort,
            order: order ?? DEFAULT_TABLE_PARAMS.order,
          }))
        }
        q={tableParams.q}
        onSearchChange={(q) => setTableParams((current) => ({ ...current, page: 1, q }))}
        f={tableParams.f}
        onFilterChange={(f) =>
          setTableParams((current) => ({
            ...current,
            page: 1,
            f,
          }))
        }
        filterOptions={filterOptions}
        labels={{
          loading: t.loading,
          empty: t.empty,
          toolbar: {
            search: t.search,
            reset: "Reset",
            viewOptions: { view: t.columns, toggleColumns: t.columns },
          },
          pagination: {
            selectedRows: t.selected,
          },
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t.edit : t.create}</DialogTitle>
            <DialogDescription>{t.subtitle}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(save)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.name}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.description}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.content}</FormLabel>
                    <FormControl>
                      <Textarea rows={6} {...field} />
                    </FormControl>
                    {isDynamic ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          form.setValue(
                            "content",
                            insertDynamicContentPlaceholder(form.getValues("content")),
                            { shouldDirty: true, shouldValidate: true },
                          );
                        }}
                      >
                        {t.insertPlaceholder}
                      </Button>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.type}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {blockTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="is_dynamic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t.dynamicLabel}</FormLabel>
                        <FormDescription>Prompt composer can ask for runtime content.</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_public"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>{t.publicLabel}</FormLabel>
                        <FormDescription>Available outside private owner scope.</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t.cancel}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {t.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.name}: {t.deleteDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleting) return;
                void deleteMutation.mutateAsync(deleting.id).finally(() => setDeleting(null));
              }}
            >
              {t.deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
