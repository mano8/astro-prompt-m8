"use client";

// Full shadcn prompt-block editor skin. State and API calls come from the
// package hook; forms are validated with Zod before create/update.
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Plus, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  usePromptBlocks,
  usePromptCompatibility,
  usePromptTransfer,
} from "@mano8/astro-prompt-m8/hooks";
import {
  hasDynamicContentPlaceholder,
  insertDynamicContentPlaceholder,
  promptBlockFacets,
  promptExportFilename,
  type PromptBlockFacet,
  type PromptBlockPublic,
  type PromptBlockSortField,
} from "@mano8/astro-prompt-m8/schemas";
import { downloadPromptExport, readPromptExportFile } from "@mano8/astro-prompt-m8/react";

import {
  DataTable,
  type DataTableFilterOptions,
  type DataTableSortDirection,
} from "@/components/m8-ui/data-table";
import { DataTableColumnHeader } from "@/components/m8-ui/data-table-column-header";
import { StateError } from "@/components/m8-ui/state-error";
import {
  ToastNotificationHost,
  toastNotification,
} from "@/components/m8-ui/toast-notification";
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
  exportLabel: string;
  exportAllLabel: string;
  importLabel: string;
  importError: string;
  saved: string;
  saveFailed: string;
  deleted: string;
  deleteFailed: string;
  exported: (count: number) => string;
  exportTruncated: (exported: number, total: number) => string;
  exportFailed: string;
  imported: (created: number, reused: number) => string;
  incompatibleTitle: string;
  incompatibleRetry: string;
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
  exportLabel: "Export",
  // `A-C8`: this hits GET /prompt-block/export/, an unpaginated read over the
  // current filter, so it exports the whole filtered set rather than the one
  // page the table is showing.
  exportAllLabel: "Export all",
  importLabel: "Import",
  importError: "Could not import file.",
  saved: "Prompt block saved.",
  saveFailed: "Could not save the prompt block.",
  deleted: "Prompt block deleted.",
  deleteFailed: "Could not delete the prompt block.",
  exported: (count) => `Exported ${count} block(s).`,
  exportTruncated: (exported, total) =>
    `Exported the first ${exported} of ${total} matching blocks. Narrow the filter to export the rest.`,
  exportFailed: "Could not export.",
  imported: (created, reused) => `Imported ${created} new, ${reused} reused.`,
  incompatibleTitle: "Prompt service unavailable",
  incompatibleRetry: "Reload",
};

const blockTypes = ["role", "task", "context", "instruction", "example", "format"] as const;

// The sortable headers this table renders. `satisfies` is the point: a column id
// the service does not declare in its sort vocabulary fails to compile here
// rather than reaching the wire as a 422.
const blockSortColumns = [
  "name",
  "type",
  "is_dynamic",
  "is_public",
] as const satisfies readonly PromptBlockSortField[];
type BlockSort = (typeof blockSortColumns)[number];

/** Guard at the header boundary, so an unexpected column id never reaches the wire. */
function isBlockSort(value: string | undefined): value is BlockSort {
  return value !== undefined && (blockSortColumns as readonly string[]).includes(value);
}

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
  const t = React.useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
  const [tableParams, setTableParams] =
    React.useState<BlockTableParams>(DEFAULT_TABLE_PARAMS);
  // Server-driven: every control the toolbar renders is forwarded, and the rows
  // and the row count are the service's answer to them.
  const { data, loading, error, createMutation, updateMutation, deleteMutation, refresh } =
    usePromptBlocks(tableParams);
  const { exportBlockMutation, exportFilteredBlocksMutation, importMutation } =
    usePromptTransfer();
  // `H5`: the session `GET /meta` preflight. A host pointed at the wrong M8
  // service gets the shared error state, not four failing requests.
  const compatibility = usePromptCompatibility();
  const [editing, setEditing] = React.useState<PromptBlockPublic | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PromptBlockPublic | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  const startEdit = React.useCallback((block: PromptBlockPublic) => {
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
  }, [form]);

  // Every mutation reports through the shared toast contract (`H7`) — the same
  // one auth and reparto use — so feedback reads the same across the fleet
  // instead of one surface printing a paragraph and another saying nothing.
  const save = async (values: BlockFormValues) => {
    const body = {
      ...values,
      description: values.description?.trim() ? values.description.trim() : null,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ blockId: editing.id, body });
      } else {
        await createMutation.mutateAsync(body);
      }
    } catch {
      toastNotification.error({ title: t.saveFailed });
      return;
    }
    toastNotification.success({ title: t.saved });
    setOpen(false);
    setEditing(null);
  };

  const exportBlock = React.useCallback(async (block: PromptBlockPublic) => {
    try {
      const payload = await exportBlockMutation.mutateAsync(block.id);
      downloadPromptExport(payload, promptExportFilename("block", block.slug));
      toastNotification.success({ title: t.exported(1) });
    } catch {
      toastNotification.error({ title: t.exportFailed });
    }
  }, [exportBlockMutation, t]);

  /**
   * Export every block in the current filter (`A-C8`), not the one page the
   * table happens to be showing — `GET /prompt-block/export/` is a second,
   * deliberately unpaginated read over the same `q`/`f`/`sort`/`order`.
   */
  const exportAllBlocks = async () => {
    try {
      const result = await exportFilteredBlocksMutation.mutateAsync({
        q: tableParams.q,
        f: tableParams.f,
        sort: tableParams.sort,
        order: tableParams.order,
      });
      if (result.exportedCount === 0) return;
      downloadPromptExport(result.payload, promptExportFilename("bundle"));
      toastNotification.success({
        title: result.truncated
          ? t.exportTruncated(result.exportedCount, result.totalCount)
          : t.exported(result.exportedCount),
      });
    } catch {
      toastNotification.error({ title: t.exportFailed });
    }
  };

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = await readPromptExportFile(file);
      const result = await importMutation.mutateAsync(parsed);
      toastNotification.success({
        title: t.imported(result.blocks.created.length, result.blocks.reused.length),
      });
    } catch {
      toastNotification.error({ title: t.importError });
    }
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
              onClick={() => void exportBlock(row.original)}
            >
              <Download className="mr-1 size-3.5" />
              {t.exportLabel}
            </Button>
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
        id: "is_dynamic",
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
        id: "is_public",
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
    [exportBlock, startEdit, t],
  );

  // Facet options are the service's declared `f` vocabulary, so a selected chip
  // is always a value the service answers.
  const facetLabels: Record<PromptBlockFacet, string> = {
    role: "role",
    task: "task",
    context: "context",
    instruction: "instruction",
    example: "example",
    format: "format",
    dynamic: "Dynamic",
    static: "Static",
    public: "Public",
    private: "Private",
  };
  const filterOptions: DataTableFilterOptions = {
    title: t.type,
    options: promptBlockFacets.map((facet) => ({ label: facetLabels[facet], value: facet })),
  };

  // An incompatible service surfaces the shared error state rather than a wall
  // of failed requests: nothing below this point can work against it.
  if (compatibility.incompatible) {
    return (
      <section className="not-content space-y-6">
        <StateError
          title={t.incompatibleTitle}
          description={compatibility.reason ?? t.error}
          retryLabel={t.incompatibleRetry}
          onRetry={() => window.location.reload()}
        />
      </section>
    );
  }

  return (
    <section className="not-content space-y-6">
      <ToastNotificationHost />
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={(data?.count ?? 0) === 0 || exportFilteredBlocksMutation.isPending}
            onClick={() => void exportAllBlocks()}
          >
            <Download className="mr-2 size-4" />
            {t.exportAllLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={importMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 size-4" />
            {t.importLabel}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onImportFile}
          />
          <Button type="button" onClick={startCreate}>
            <Plus className="mr-2 size-4" />
            {t.create}
          </Button>
        </div>
      </div>

      {loading && !data ?  <p className="text-sm text-muted-foreground">{t.loading}</p> : null}
      {error && !data ? (
        <p role="alert" className="text-sm text-destructive">
          {t.error}
        </p>
      ) : null}

      <DataTable
        key="prompt-block-table-actions-v2"
        columns={columns}
        data={data?.data ?? []}
        loading={loading}
        rowCount={data?.count ?? 0}
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
            sort: isBlockSort(sort) ? sort : DEFAULT_TABLE_PARAMS.sort,
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
                void deleteMutation
                  .mutateAsync(deleting.id)
                  .then(() => toastNotification.success({ title: t.deleted }))
                  .catch(() => toastNotification.error({ title: t.deleteFailed }))
                  .finally(() => setDeleting(null));
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
