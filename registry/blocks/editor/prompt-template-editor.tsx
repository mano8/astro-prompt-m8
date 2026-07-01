"use client";

// Full shadcn prompt-template editor skin. It uses DataTable for templates and
// attached blocks, and validates create/update forms with Zod.
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, FileText, Plus, Wand2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePromptBlocks, usePromptTemplates, useComposePrompt } from "@mano8/astro-prompt-m8/hooks";
import type {
  PromptBlockPublic,
  PromptTemplatePublic,
  TemplateBlockPublic,
} from "@mano8/astro-prompt-m8/schemas";

import { DataTable, type DataTableFilter } from "@/components/fa-prompt/data-table";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export interface PromptTemplateEditorLabels {
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
  publicLabel: string;
  blocks: string;
  block: string;
  addBlock: string;
  removeBlock: string;
  moveUp: string;
  moveDown: string;
  compose: string;
  composeTitle: string;
  composeResult: string;
  dynamicFor: string;
  noDynamic: string;
  loading: string;
  empty: string;
  error: string;
  searchTemplates: string;
  searchBlocks: string;
  allPublic: string;
  allDynamic: string;
  allTypes: string;
  columns: string;
  selected: (selected: number, total: number) => string;
}

const DEFAULT_LABELS: PromptTemplateEditorLabels = {
  title: "Prompt templates",
  subtitle: "Search, filter, select columns, and maintain prompt templates.",
  create: "New template",
  edit: "Edit",
  deleteLabel: "Delete",
  deleteTitle: "Delete prompt template?",
  deleteDescription: "This removes the template and detaches all blocks.",
  save: "Save",
  cancel: "Cancel",
  actions: "Actions",
  name: "Name",
  description: "Description",
  publicLabel: "Public",
  blocks: "Blocks",
  block: "Block",
  addBlock: "Add block",
  removeBlock: "Remove",
  moveUp: "Up",
  moveDown: "Down",
  compose: "Compose",
  composeTitle: "Compose template",
  composeResult: "Composed prompt",
  dynamicFor: "Dynamic content for",
  noDynamic: "This template has no dynamic blocks.",
  loading: "Loading...",
  empty: "No prompt templates.",
  error: "Could not load prompt templates.",
  searchTemplates: "Search templates...",
  searchBlocks: "Search blocks...",
  allPublic: "Public + private",
  allDynamic: "Dynamic + static",
  allTypes: "All types",
  columns: "Columns",
  selected: (selected, total) => `${selected} of ${total} selected`,
};

const templateFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  is_public: z.boolean(),
});
type TemplateFormValues = z.infer<typeof templateFormSchema>;

const emptyValues: TemplateFormValues = {
  name: "",
  description: "",
  is_public: false,
};

const blockTypes = ["role", "task", "context", "instruction", "example", "format"] as const;

export interface PromptTemplateEditorSkinProps {
  labels?: Partial<PromptTemplateEditorLabels>;
}

export default function PromptTemplateEditorSkin({ labels }: PromptTemplateEditorSkinProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const templates = usePromptTemplates();
  const blocks = usePromptBlocks();
  const { compose, composeMutation } = useComposePrompt();
  const [editing, setEditing] = React.useState<PromptTemplatePublic | null>(null);
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PromptTemplatePublic | null>(null);
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [blockToAdd, setBlockToAdd] = React.useState<string>("");
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [dynamicFields, setDynamicFields] = React.useState<Record<number, string>>({});
  const [composeError, setComposeError] = React.useState<string | null>(null);

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: emptyValues,
  });

  React.useEffect(() => {
    void templates.refresh();
    void blocks.refresh();
  }, [templates.refresh, blocks.refresh]);

  const activeTemplate =
    templates.data?.data.find((template) => template.id === activeId) ??
    templates.data?.data[0] ??
    null;

  React.useEffect(() => {
    if (activeId === null && templates.data?.data[0]) {
      setActiveId(templates.data.data[0].id);
    }
  }, [activeId, templates.data]);

  const availableBlocks = React.useMemo<PromptBlockPublic[]>(() => {
    const used = new Set((activeTemplate?.blocks ?? []).map((block) => block.block_id));
    return (blocks.data?.data ?? []).filter((block) => !used.has(block.id));
  }, [activeTemplate, blocks.data]);

  const startCreate = () => {
    setEditing(null);
    form.reset(emptyValues);
    setOpen(true);
  };

  const startEdit = (template: PromptTemplatePublic) => {
    setEditing(template);
    form.reset({
      name: template.name,
      description: template.description ?? "",
      is_public: template.is_public,
    });
    setOpen(true);
  };

  const save = async (values: TemplateFormValues) => {
    const body = {
      ...values,
      description: values.description?.trim() ? values.description.trim() : null,
    };
    if (editing) {
      await templates.updateMutation.mutateAsync({ templateId: editing.id, body });
    } else {
      const created = await templates.createMutation.mutateAsync(body);
      setActiveId(created.id);
    }
    setOpen(false);
    setEditing(null);
  };

  const runCompose = async () => {
    if (!activeTemplate) return;
    try {
      setComposeError(null);
      await compose(
        activeTemplate.id,
        activeTemplate.blocks
          .filter((block) => block.is_dynamic && (dynamicFields[block.block_id] ?? "").trim() !== "")
          .map((block) => ({
            id: block.block_id,
            content: dynamicFields[block.block_id] ?? "",
          })),
      );
    } catch {
      setComposeError("Could not compose template.");
    }
  };

  const templateColumns = React.useMemo<ColumnDef<PromptTemplatePublic>[]>(
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
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            {t.name}
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        ),
      },
      {
        id: "actions",
        header: t.actions,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-48 flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setActiveId(row.original.id)}
            >
              {t.blocks}
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
        accessorFn: (row) => (row.is_public ? "public" : "private"),
        id: "visibility",
        header: t.publicLabel,
        cell: ({ row }) => (
          <Badge variant={row.original.is_public ? "default" : "outline"}>
            {row.original.is_public ? "Public" : "Private"}
          </Badge>
        ),
      },
      {
        accessorFn: (row) => String(row.blocks.length),
        id: "block_count",
        header: t.blocks,
        cell: ({ row }) => row.original.blocks.length,
      },
      {
        accessorKey: "description",
        header: t.description,
        cell: ({ row }) => row.original.description ?? "",
      },
    ],
    [t],
  );

  const blockColumns = React.useMemo<ColumnDef<TemplateBlockPublic>[]>(
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
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            {t.name}
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        ),
      },
      {
        id: "actions",
        header: t.actions,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex min-w-40 flex-wrap gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-7 p-0"
              disabled={!activeTemplate || row.index === 0 || templates.setPositionMutation.isPending}
              onClick={() => {
                if (!activeTemplate) return;
                templates.setPositionMutation.mutate({
                  templateId: activeTemplate.id,
                  blockId: row.original.block_id,
                  position: row.original.position - 1,
                });
              }}
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">{t.moveUp}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="size-7 p-0"
              disabled={
                !activeTemplate ||
                row.index === activeTemplate.blocks.length - 1 ||
                templates.setPositionMutation.isPending
              }
              onClick={() => {
                if (!activeTemplate) return;
                templates.setPositionMutation.mutate({
                  templateId: activeTemplate.id,
                  blockId: row.original.block_id,
                  position: row.original.position + 1,
                });
              }}
            >
              <ArrowDown className="size-4" />
              <span className="sr-only">{t.moveDown}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              disabled={!activeTemplate || templates.removeBlockMutation.isPending}
              onClick={() => {
                if (!activeTemplate) return;
                templates.removeBlockMutation.mutate({
                  templateId: activeTemplate.id,
                  blockId: row.original.block_id,
                });
              }}
            >
              {t.removeBlock}
            </Button>
          </div>
        ),
      },
      { accessorKey: "type", header: t.type },
      {
        accessorFn: (row) => (row.is_dynamic ? "dynamic" : "static"),
        id: "dynamic",
        header: "Dynamic",
        cell: ({ row }) => (
          <Badge variant={row.original.is_dynamic ? "default" : "secondary"}>
            {row.original.is_dynamic ? "Dynamic" : "Static"}
          </Badge>
        ),
      },
      {
        accessorFn: (row) => (row.is_public ? "public" : "private"),
        id: "visibility",
        header: t.publicLabel,
        cell: ({ row }) => (
          <Badge variant={row.original.is_public ? "default" : "outline"}>
            {row.original.is_public ? "Public" : "Private"}
          </Badge>
        ),
      },
      {
        accessorKey: "position",
        header: "Position",
      },
      {
        accessorKey: "content",
        header: "Content",
        cell: ({ row }) => (
          <p className="line-clamp-2 max-w-xl whitespace-pre-wrap text-muted-foreground">
            {row.original.content}
          </p>
        ),
      },
    ],
    [activeTemplate, t, templates.removeBlockMutation, templates.setPositionMutation],
  );

  const publicFilter: DataTableFilter = {
    columnId: "visibility",
    label: t.publicLabel,
    allLabel: t.allPublic,
    options: [
      { label: "Public", value: "public" },
      { label: "Private", value: "private" },
    ],
  };
  const blockFilters: DataTableFilter[] = [
    {
      columnId: "type",
      label: t.type,
      allLabel: t.allTypes,
      options: blockTypes.map((type) => ({ label: type, value: type })),
    },
    {
      columnId: "dynamic",
      label: "Dynamic",
      allLabel: t.allDynamic,
      options: [
        { label: "Dynamic", value: "dynamic" },
        { label: "Static", value: "static" },
      ],
    },
    publicFilter,
  ];

  return (
    <section className="not-content space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button type="button" onClick={startCreate}>
          <Plus className="mr-2 size-4" />
          {t.create}
        </Button>
      </div>

      {templates.loading && !templates.data ? (
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      ) : null}
      {templates.error && !templates.data ? (
        <p role="alert" className="text-sm text-destructive">
          {t.error}
        </p>
      ) : null}

      <DataTable
        key="prompt-template-table-actions-v2"
        columns={templateColumns}
        data={templates.data?.data ?? []}
        searchColumn="name"
        searchPlaceholder={t.searchTemplates}
        filters={[publicFilter]}
        emptyMessage={t.empty}
        columnsLabel={t.columns}
        selectedLabel={t.selected}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            {activeTemplate ? activeTemplate.name : t.blocks}
          </CardTitle>
          <CardDescription>
            {activeTemplate?.description ?? t.blocks}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTemplate ? (
            <>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Select value={blockToAdd} onValueChange={setBlockToAdd}>
                  <SelectTrigger className="md:max-w-sm">
                    <SelectValue placeholder={t.addBlock} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBlocks.map((block) => (
                      <SelectItem key={block.id} value={String(block.id)}>
                        {block.name} ({block.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!blockToAdd || templates.addBlockMutation.isPending}
                  onClick={() => {
                    templates.addBlockMutation.mutate({
                      templateId: activeTemplate.id,
                      blockId: Number(blockToAdd),
                      position: activeTemplate.blocks.length,
                    });
                    setBlockToAdd("");
                  }}
                >
                  <Plus className="mr-2 size-4" />
                  {t.addBlock}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="md:ml-auto"
                  onClick={() => {
                    setDynamicFields({});
                    setComposeOpen(true);
                  }}
                >
                  <Wand2 className="mr-2 size-4" />
                  {t.compose}
                </Button>
              </div>
              <DataTable
                key={`prompt-template-blocks-actions-v2-${activeTemplate.id}`}
                columns={blockColumns}
                data={activeTemplate.blocks}
                searchColumn="name"
                searchPlaceholder={t.searchBlocks}
                filters={blockFilters}
                emptyMessage={t.blocks}
                columnsLabel={t.columns}
                selectedLabel={t.selected}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t.cancel}
                </Button>
                <Button
                  type="submit"
                  disabled={templates.createMutation.isPending || templates.updateMutation.isPending}
                >
                  {t.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.composeTitle}</DialogTitle>
            <DialogDescription>{activeTemplate?.name}</DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            {(activeTemplate?.blocks ?? []).filter((block) => block.is_dynamic).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noDynamic}</p>
            ) : (
              (activeTemplate?.blocks ?? [])
                .filter((block) => block.is_dynamic)
                .map((block) => (
                  <div key={block.block_id} className="space-y-2">
                    <label className="text-sm font-medium">
                      {t.dynamicFor}: {block.name}
                    </label>
                    <Textarea
                      rows={3}
                      value={dynamicFields[block.block_id] ?? ""}
                      onChange={(event) =>
                        setDynamicFields((current) => ({
                          ...current,
                          [block.block_id]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))
            )}
            {composeError ? (
              <p role="alert" className="text-sm text-destructive">
                {composeError}
              </p>
            ) : null}
            {composeMutation.data?.content ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t.composeResult}</p>
                <pre className="max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-3 text-sm">
                  {composeMutation.data.content}
                </pre>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>
              {t.cancel}
            </Button>
            <Button type="button" disabled={composeMutation.isPending} onClick={() => void runCompose()}>
              {t.compose}
            </Button>
          </DialogFooter>
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
              disabled={templates.deleteMutation.isPending}
              onClick={() => {
                if (!deleting) return;
                void templates.deleteMutation
                  .mutateAsync(deleting.id)
                  .finally(() => {
                    setDeleting(null);
                    if (activeId === deleting.id) setActiveId(null);
                  });
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
